/** Opt-in real PostgreSQL tests. This file refuses every non-disposable target. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { createPrismaIngestionRepository } from "../src/lib/db/ingestion";
import {
  createIngestor,
  IngestionFailedError,
  IngestionLeaseLostError,
  UploadInProgressError,
  uploadContentKey,
} from "../src/lib/ingest/pipeline";
import { normalizeCompanyName } from "../src/lib/db/queries";
import type {
  ClaimInput,
  IngestionCompletion,
  IngestionClaim,
  OwnedIngestion,
} from "../src/lib/ingest/contract";

const databaseUrl = process.env.INGESTION_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    target.protocol !== "postgresql:" ||
    target.hostname !== "127.0.0.1" ||
    target.pathname !== "/vc_memory_idempotency_test"
  )
    throw new Error(
      "Ingestion integration tests require the disposable loopback vc_memory_idempotency_test database.",
    );
}

const run = randomUUID();
const filePrefix = `idempotency-fixture-${run}-`;
const companyPrefix = `Idempotency fixture ${run}`;
const fixture = (name: string) => ({
  buffer: Buffer.from(
    `A sufficiently detailed fictional source ${run} ${name}.`,
  ),
  filename: `${filePrefix}${name}.md`,
  mime: "text/markdown",
});
const payload = (
  name: string,
  strength = "A signal.",
): IngestionCompletion => ({
  text: `A fictional retained source ${name}.`,
  intelligence: {
    company: `${companyPrefix} ${name}`,
    strengths: [strength],
    risks: [],
  },
  chunks: [{ content: `Source ${name}`, ordinal: 0, embedding: [1, 0] }],
});
const claimInput = (name: string, ownerToken = randomUUID()): ClaimInput => ({
  key: uploadContentKey(fixture(name).buffer, "md"),
  ownerToken,
  filename: fixture(name).filename,
  fileType: "md",
  sizeBytes: fixture(name).buffer.length,
  metAt: new Date("2025-05-01T00:00:00Z"),
});
function owned(result: IngestionClaim): OwnedIngestion {
  assert.equal(result.kind, "owned");
  if (result.kind !== "owned") throw new Error("Expected owned fixture claim");
  return result.claim;
}

// Every test shares only this explicitly supplied disposable database; production
// environment variables are not used to construct either of these connections.
test(
  "durable ingestion invariants on real PostgreSQL",
  { skip: !databaseUrl, timeout: 30_000 },
  async (t) => {
    const connectionOptions = {
      datasources: { db: { url: databaseUrl! } },
      transactionOptions: {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    };
    const a = new PrismaClient(connectionOptions);
    const b = new PrismaClient(connectionOptions);
    const repoA = createPrismaIngestionRepository(a),
      repoB = createPrismaIngestionRepository(b);
    t.after(async () => {
      await a.document.deleteMany({
        where: { filename: { startsWith: filePrefix } },
      });
      await a.company.deleteMany({
        where: { name: { startsWith: companyPrefix, mode: "insensitive" } },
      });
      await Promise.all([a.$disconnect(), b.$disconnect()]);
    });
    assert.equal(
      (
        await a.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`
      )[0].name,
      "vc_memory_idempotency_test",
    );
    const defaults = await a.$transaction(
      (tx) =>
        tx.$queryRaw<
          { isolation: string }[]
        >`SELECT current_setting('transaction_isolation') AS isolation`,
    );
    assert.equal(defaults[0].isolation, "repeatable read");

    await t.test(
      "parallel identical uploads create one document and replay without any provider work",
      async () => {
        let release!: () => void, started!: () => void;
        const providerStarted = new Promise<void>((resolve) => {
          started = resolve;
        });
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let calls = 0;
        const source = fixture("parallel");
        const make = (repository: typeof repoA) =>
          createIngestor({
            repository,
            extractText: async () => ({
              text: source.buffer.toString(),
              fileType: "md",
            }),
            extractIntelligence: async () => {
              calls++;
              started();
              await gate;
              return payload("parallel").intelligence;
            },
            embed: async (texts) => texts.map(() => [1, 0]),
          });
        const first = make(repoA)(source);
        await Promise.race([
          providerStarted,
          first.then(() => {
            throw new Error("Fixture provider did not block");
          }),
        ]);
        await assert.rejects(
          make(repoB)({ ...source, filename: `${filePrefix}renamed.md` }),
          UploadInProgressError,
        );
        assert.equal(
          await b.document.count({ where: { filename: source.filename } }),
          1,
        );
        assert.equal(
          await b.company.count({
            where: { name: payload("parallel").intelligence.company },
          }),
          0,
        );
        release();
        const completed = await first;
        const replay = await make(repoB)(source);
        assert.equal(replay.documentId, completed.documentId);
        assert.equal(replay.companyId, completed.companyId);
        assert.equal(replay.reused, true);
        assert.equal(calls, 1);
        assert.equal(
          await b.chunk.count({ where: { documentId: completed.documentId } }),
          1,
        );
      },
    );

    await t.test(
      "failed provider work retries the same document without partial company or chunks",
      async () => {
        const source = fixture("failure");
        let fail = true;
        const ingest = createIngestor({
          repository: repoA,
          extractText: async () => ({
            text: source.buffer.toString(),
            fileType: "md",
          }),
          extractIntelligence: async () => {
            if (fail) throw new Error("private provider detail");
            return payload("failure").intelligence;
          },
          embed: async (texts) => texts.map(() => [1, 0]),
        });
        await assert.rejects(ingest(source), IngestionFailedError);
        const original = await a.document.findFirstOrThrow({
          where: { filename: source.filename },
        });
        assert.equal(original.status, "failed");
        assert.equal(original.companyId, null);
        assert.equal(
          await a.chunk.count({ where: { documentId: original.id } }),
          0,
        );
        fail = false;
        const retried = await ingest(source);
        assert.equal(retried.documentId, original.id);
        assert.equal(
          await a.document.count({ where: { filename: source.filename } }),
          1,
        );
        assert.equal(
          (
            await a.$queryRaw<
              { attempts: number }[]
            >`SELECT attempts FROM "UploadIngestion" WHERE "key" = ${uploadContentKey(source.buffer, "md")}`
          )[0].attempts,
          2,
        );
      },
    );

    await t.test(
      "expired workers cannot renew, fail or commit over a replacement owner",
      async () => {
        const request = claimInput("takeover");
        const old = owned(await repoA.claim(request));
        await a.$executeRaw`UPDATE "UploadIngestion" SET "leaseUntil" = timezone('UTC', clock_timestamp()) - interval '1 second' WHERE "key" = ${request.key}`;
        const current = owned(
          await repoB.claim({ ...request, ownerToken: randomUUID() }),
        );
        assert.equal(current.documentId, old.documentId);
        assert.equal(await repoA.renew(old), false);
        await repoA.fail(old);
        await assert.rejects(
          repoA.complete(old, payload("takeover")),
          IngestionLeaseLostError,
        );
        assert.equal(
          (
            await a.$queryRaw<
              { state: string; ownerToken: string }[]
            >`SELECT state, "ownerToken" FROM "UploadIngestion" WHERE "key" = ${request.key}`
          )[0].ownerToken,
          current.ownerToken,
        );
        await repoB.complete(current, payload("takeover"));
        assert.equal(
          await a.company.count({
            where: { name: payload("takeover").intelligence.company },
          }),
          1,
        );
      },
    );

    for (const action of ["renew", "fail", "complete"] as const)
      await t.test(
        `lease expiry while ${action} waits for a row lock cannot revive ownership`,
        async () => {
          const name = `row-lock-${action}`;
          const claim = owned(await repoA.claim(claimInput(name)));
          await a.$executeRaw`UPDATE "UploadIngestion" SET "leaseUntil" = timezone('UTC', clock_timestamp()) + interval '0.4 seconds' WHERE "key" = ${claim.key}`;
          let locked!: () => void, release!: () => void;
          const acquired = new Promise<void>((resolve) => {
            locked = resolve;
          });
          const hold = new Promise<void>((resolve) => {
            release = resolve;
          });
          const blocking = b.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT "key" FROM "UploadIngestion" WHERE "key" = ${claim.key} FOR UPDATE`;
              locked();
              await hold;
            },
            { timeout: 5000 },
          );
          await acquired;
          const attempt =
            action === "renew"
              ? repoA.renew(claim)
              : action === "fail"
                ? repoA.fail(claim)
                : repoA.complete(claim, payload(name));
          // Install rejection handling before intentionally keeping the lock past expiry.
          const observed = attempt.then(
            (value) => ({ value, error: null }),
            (error) => ({ value: undefined, error }),
          );
          await new Promise((resolve) => setTimeout(resolve, 550));
          release();
          await blocking;
          const outcome = await observed;
          if (action === "renew") assert.equal(outcome.value, false);
          else if (action === "complete")
            assert.ok(outcome.error instanceof IngestionLeaseLostError);
          else assert.equal(outcome.error, null);
          assert.equal(
            (
              await a.$queryRaw<
                { state: string }[]
              >`SELECT state FROM "UploadIngestion" WHERE "key" = ${claim.key}`
            )[0].state,
            "processing",
          );
          assert.equal(
            await a.company.count({
              where: { name: payload(name).intelligence.company },
            }),
            0,
          );
        },
      );

    await t.test(
      "lease expiry while waiting for the company lock rolls back finalization",
      async () => {
        const claim = owned(await repoA.claim(claimInput("company-lock")));
        const completion = payload("company-lock");
        await a.$executeRaw`UPDATE "UploadIngestion" SET "leaseUntil" = timezone('UTC', clock_timestamp()) + interval '0.4 seconds' WHERE "key" = ${claim.key}`;
        let locked!: () => void, release!: () => void;
        const acquired = new Promise<void>((resolve) => {
          locked = resolve;
        });
        const hold = new Promise<void>((resolve) => {
          release = resolve;
        });
        const blocking = b.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`company:${normalizeCompanyName(completion.intelligence.company)}`}, 0))`;
            locked();
            await hold;
          },
          { timeout: 5000 },
        );
        await acquired;
        const observed = repoA.complete(claim, completion).then(
          () => null,
          (error) => error,
        );
        await new Promise((resolve) => setTimeout(resolve, 550));
        release();
        await blocking;
        assert.ok((await observed) instanceof IngestionLeaseLostError);
        assert.equal(
          await a.company.count({
            where: { name: completion.intelligence.company },
          }),
          0,
        );
      },
    );

    await t.test(
      "a failed chunk write rolls back company, document and completion together",
      async () => {
        const claim = owned(await repoA.claim(claimInput("rollback")));
        const completion = payload("rollback");
        await assert.rejects(
          repoA.complete(claim, {
            ...completion,
            chunks: [
              {
                content: "Invalid ordinal",
                ordinal: 2 ** 40,
                embedding: [1, 0],
              },
            ],
          }),
        );
        const document = await a.document.findUniqueOrThrow({
          where: { id: claim.documentId },
        });
        assert.equal(document.status, "processing");
        assert.equal(document.companyId, null);
        assert.equal(document.rawText, "");
        assert.equal(
          await a.company.count({
            where: { name: completion.intelligence.company },
          }),
          0,
        );
        assert.equal(
          await a.chunk.count({ where: { documentId: claim.documentId } }),
          0,
        );
        await repoA.fail(claim);
        const retry = owned(await repoA.claim(claimInput("rollback")));
        assert.equal(retry.documentId, claim.documentId);
        await repoA.complete(retry, completion);
      },
    );

    await t.test(
      "different documents for the same company serialize their accumulated memory",
      async () => {
        const first = owned(await repoA.claim(claimInput("company-a")));
        const second = owned(await repoB.claim(claimInput("company-b")));
        const name = `${companyPrefix} shared company`;
        const lockKey = `company:${normalizeCompanyName(name)}`;
        let locked!: () => void, release!: () => void;
        const acquired = new Promise<void>((resolve) => {
          locked = resolve;
        });
        const hold = new Promise<void>((resolve) => {
          release = resolve;
        });
        const blocking = b.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
            locked();
            await hold;
          },
          { timeout: 10_000 },
        );
        await acquired;
        const completing = Promise.all([
          repoA.complete(first, {
            ...payload("company-a"),
            intelligence: { company: name, strengths: ["First signal"] },
          }),
          repoB.complete(second, {
            ...payload("company-b"),
            intelligence: {
              company: name.toUpperCase(),
              strengths: ["Second signal"],
            },
          }),
        ]);
        // Both transactions must begin and wait before either company exists.
        // With a caller-default RepeatableRead snapshot, failing to explicitly
        // use ReadCommitted in the repository would create two company rows.
        let waiters = 0;
        try {
          for (let attempt = 0; attempt < 100 && waiters < 2; attempt++) {
            const result = await a.$queryRaw<{ count: number }[]>`
              WITH target AS (SELECT hashtextextended(${lockKey}, 0) AS key)
              SELECT count(*)::int AS count FROM pg_locks, target
              WHERE locktype = 'advisory' AND NOT granted AND objsubid = 1
                AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
                AND classid::bigint = ((target.key >> 32) & 4294967295)
                AND objid::bigint = (target.key & 4294967295)`;
            waiters = result[0].count;
            if (waiters < 2)
              await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.equal(
            waiters,
            2,
            "both company writers must be waiting on the same advisory lock",
          );
        } finally {
          release();
          await blocking;
        }
        const [one, two] = await completing;
        assert.equal(one.companyId, two.companyId);
        const company = await a.company.findUniqueOrThrow({
          where: { id: one.companyId },
        });
        assert.deepEqual((company.strengths as string[]).slice().sort(), [
          "First signal",
          "Second signal",
        ]);
        assert.equal(
          await a.document.count({
            where: { id: { in: [one.documentId, two.documentId] } },
          }),
          2,
        );
      },
    );
  },
);
