import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeCompanyName, upsertCompanyFromExtraction } from "./queries";
import { extractedIntelligenceSchema } from "@/lib/validators";
import {
  INGESTION_LEASE_MS,
  IngestionLeaseLostError,
  type ClaimInput,
  type IngestionClaim,
  type IngestionRepository,
  type IngestionResult,
  type OwnedIngestion,
  type IngestionCompletion,
} from "@/lib/ingest/contract";

type Job = {
  key: string;
  documentId: string;
  ownerToken: string;
  state: string;
  metAt: Date;
  retryAfterSeconds: number;
};
const transactionOptions = {
  maxWait: 5_000,
  timeout: 20_000,
  // A statement after the company advisory lock must see the preceding
  // owner's commit, even when a caller configures a snapshot-isolation default.
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

/** Leases use PostgreSQL's actual clock; clients cannot extend or forge ownership. */
export function createPrismaIngestionRepository(
  client: PrismaClient = prisma,
): IngestionRepository {
  return {
    async claim(input: ClaimInput): Promise<IngestionClaim> {
      return client.$transaction(async (tx) => {
        // Serializes the first INSERT as well as retries across separate server instances.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`upload:${input.key}`}, 0))`;
        const jobs = await tx.$queryRaw<Job[]>`
          SELECT *, GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("leaseUntil" - timezone('UTC', clock_timestamp())))))::int AS "retryAfterSeconds"
          FROM "UploadIngestion" WHERE "key" = ${input.key} FOR UPDATE`;
        const job = jobs[0];
        if (job?.state === "completed") {
          const document = await tx.document.findUnique({
            where: { id: job.documentId },
            select: {
              id: true,
              companyId: true,
              intelligence: true,
              status: true,
            },
          });
          const parsed = extractedIntelligenceSchema.safeParse(
            document?.intelligence,
          );
          if (
            !document?.companyId ||
            document.status !== "processed" ||
            !parsed.success
          )
            throw new Error(
              "The saved upload result is unavailable. Ask the workspace maintainer to inspect the document.",
            );
          return {
            kind: "complete",
            result: {
              documentId: document.id,
              companyId: document.companyId,
              intelligence: parsed.data,
              reused: true,
            },
          };
        }
        // Recheck actual DB time after acquiring the row lock; SELECT expressions
        // may have been evaluated before waiting for a conflicting transaction.
        if (job) {
          const active = await tx.$queryRaw<{ seconds: number }[]>`
            SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("leaseUntil" - timezone('UTC', clock_timestamp())))))::int AS seconds
            FROM "UploadIngestion" WHERE "key" = ${input.key} AND "state" = 'processing'
              AND "leaseUntil" > timezone('UTC', clock_timestamp())`;
          if (active[0])
            return {
              kind: "busy",
              retryAfterSeconds: Math.min(120, Math.max(1, active[0].seconds)),
            };
          await tx.$executeRaw`
            UPDATE "UploadIngestion" SET "ownerToken" = ${input.ownerToken}, "state" = 'processing',
              "attempts" = "attempts" + 1, "updatedAt" = timezone('UTC', clock_timestamp()),
              "leaseUntil" = timezone('UTC', clock_timestamp()) + (${INGESTION_LEASE_MS}::double precision * interval '1 millisecond')
            WHERE "key" = ${input.key}`;
          await tx.document.update({
            where: { id: job.documentId },
            data: { status: "processing", error: null },
          });
          return {
            kind: "owned",
            claim: {
              key: input.key,
              ownerToken: input.ownerToken,
              documentId: job.documentId,
              metAt: job.metAt,
            },
          };
        }
        // No provider or parsing calls happen until this unique durable claim commits.
        const document = await tx.document.create({
          data: {
            filename: input.filename,
            fileType: input.fileType,
            rawText: "",
            sizeBytes: input.sizeBytes,
            status: "processing",
          },
        });
        await tx.$executeRaw`
          INSERT INTO "UploadIngestion" ("key", "documentId", "ownerToken", "leaseUntil", "state", "attempts", "metAt", "createdAt", "updatedAt")
          VALUES (${input.key}, ${document.id}, ${input.ownerToken},
            timezone('UTC', clock_timestamp()) + (${INGESTION_LEASE_MS}::double precision * interval '1 millisecond'),
            'processing', 1, ${input.metAt}, timezone('UTC', clock_timestamp()), timezone('UTC', clock_timestamp()))`;
        return {
          kind: "owned",
          claim: {
            key: input.key,
            ownerToken: input.ownerToken,
            documentId: document.id,
            metAt: input.metAt,
          },
        };
      }, transactionOptions);
    },

    async renew(claim: OwnedIngestion): Promise<boolean> {
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "key" FROM "UploadIngestion" WHERE "key" = ${claim.key} FOR UPDATE`;
        const changed = await tx.$executeRaw`
          UPDATE "UploadIngestion" SET "leaseUntil" = timezone('UTC', clock_timestamp()) + (${INGESTION_LEASE_MS}::double precision * interval '1 millisecond'),
            "updatedAt" = timezone('UTC', clock_timestamp())
          WHERE "key" = ${claim.key} AND "ownerToken" = ${claim.ownerToken} AND "state" = 'processing'
            AND "leaseUntil" > timezone('UTC', clock_timestamp())`;
        return changed === 1;
      }, transactionOptions);
    },

    async complete(
      claim: OwnedIngestion,
      input: IngestionCompletion,
    ): Promise<IngestionResult> {
      return client.$transaction(async (tx) => {
        const jobs = await tx.$queryRaw<
          Job[]
        >`SELECT * FROM "UploadIngestion" WHERE "key" = ${claim.key} FOR UPDATE`;
        const job = jobs[0];
        if (
          !job ||
          job.state !== "processing" ||
          job.ownerToken !== claim.ownerToken ||
          job.documentId !== claim.documentId
        )
          throw new IngestionLeaseLostError();
        // Different source files can describe the same company. Serialize its
        // read/union/write so concurrent ingestions cannot create duplicate rows
        // or overwrite one another's accumulated arrays.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`company:${normalizeCompanyName(input.intelligence.company)}`}, 0))`;
        const valid = await tx.$executeRaw`
          UPDATE "UploadIngestion" SET "updatedAt" = timezone('UTC', clock_timestamp())
          WHERE "key" = ${claim.key} AND "ownerToken" = ${claim.ownerToken} AND "state" = 'processing'
            AND "leaseUntil" > timezone('UTC', clock_timestamp())`;
        if (valid !== 1) throw new IngestionLeaseLostError();
        const company = await upsertCompanyFromExtraction(input.intelligence, {
          metAt: job.metAt,
          db: tx,
        });
        await tx.document.update({
          where: { id: claim.documentId },
          data: {
            rawText: input.text,
            companyId: company.id,
            docType: input.intelligence.docType ?? null,
            intelligence:
              input.intelligence as unknown as Prisma.InputJsonValue,
            status: "processed",
            error: null,
          },
        });
        await tx.chunk.deleteMany({ where: { documentId: claim.documentId } });
        if (input.chunks.length)
          await tx.chunk.createMany({
            data: input.chunks.map((chunk) => ({
              documentId: claim.documentId,
              companyId: company.id,
              content: chunk.content,
              ordinal: chunk.ordinal,
              embedding: chunk.embedding as unknown as Prisma.InputJsonValue,
            })),
          });
        const completed = await tx.$executeRaw`
          UPDATE "UploadIngestion" SET "state" = 'completed', "updatedAt" = timezone('UTC', clock_timestamp()), "leaseUntil" = timezone('UTC', clock_timestamp())
          WHERE "key" = ${claim.key} AND "ownerToken" = ${claim.ownerToken} AND "state" = 'processing'
            AND "leaseUntil" > timezone('UTC', clock_timestamp())`;
        if (completed !== 1) throw new IngestionLeaseLostError();
        return {
          documentId: claim.documentId,
          companyId: company.id,
          intelligence: input.intelligence,
          reused: false,
        };
      }, transactionOptions);
    },

    async fail(claim: OwnedIngestion): Promise<void> {
      await client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "key" FROM "UploadIngestion" WHERE "key" = ${claim.key} FOR UPDATE`;
        const changed = await tx.$executeRaw`
          UPDATE "UploadIngestion" SET "state" = 'failed', "updatedAt" = timezone('UTC', clock_timestamp()), "leaseUntil" = timezone('UTC', clock_timestamp())
          WHERE "key" = ${claim.key} AND "ownerToken" = ${claim.ownerToken} AND "state" = 'processing'
            AND "leaseUntil" > timezone('UTC', clock_timestamp())`;
        // A timed-out or superseded attempt cannot mark the current owner's work failed.
        if (changed === 1)
          await tx.document.update({
            where: { id: claim.documentId },
            data: {
              status: "failed",
              error:
                "Processing failed. Retry this upload to reuse the same document.",
            },
          });
      }, transactionOptions);
    },
  };
}
