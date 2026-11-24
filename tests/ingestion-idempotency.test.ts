import assert from "node:assert/strict";
import test from "node:test";
import {
  createIngestor,
  IngestionFailedError,
  UploadInProgressError,
  uploadContentKey,
} from "../src/lib/ingest/pipeline";
import type {
  IngestionRepository,
  OwnedIngestion,
} from "../src/lib/ingest/contract";

const input = {
  buffer: Buffer.from(
    "A sufficiently detailed fictional source for upload tests.",
  ),
  filename: "fixture.md",
  mime: "text/markdown",
};
const intelligence = {
  company: "Fictional upload company",
  strengths: ["A signal."],
};
const result = {
  documentId: "document-1",
  companyId: "company-1",
  intelligence,
};
function fixture() {
  const calls = { parse: 0, extract: 0, embed: 0, complete: 0, fail: 0 };
  const claim: OwnedIngestion = {
    key: "fixture-key",
    ownerToken: "owner-1",
    documentId: "document-1",
    metAt: new Date("2026-01-01"),
  };
  const repository: IngestionRepository = {
    claim: async () => ({ kind: "owned", claim }),
    renew: async () => true,
    complete: async () => {
      calls.complete++;
      return result;
    },
    fail: async () => {
      calls.fail++;
    },
  };
  const dependencies = {
    repository,
    extractText: async () => {
      calls.parse++;
      return { text: input.buffer.toString(), fileType: "md" as const };
    },
    extractIntelligence: async () => {
      calls.extract++;
      return intelligence;
    },
    embed: async (texts: string[]) => {
      calls.embed++;
      return texts.map(() => [1, 0]);
    },
  };
  return { calls, dependencies, repository };
}

test("content identity is stable for exact bytes and distinguishes parser semantics", () => {
  assert.equal(
    uploadContentKey(input.buffer, "md"),
    uploadContentKey(Buffer.from(input.buffer), "md"),
  );
  assert.notEqual(
    uploadContentKey(input.buffer, "md"),
    uploadContentKey(input.buffer, "txt"),
  );
  assert.notEqual(
    uploadContentKey(input.buffer, "md"),
    uploadContentKey(Buffer.concat([input.buffer, Buffer.from(" ")]), "md"),
  );
  assert.match(
    uploadContentKey(input.buffer, "md"),
    /^upload-v1:md:[a-f0-9]{64}$/,
  );
});

test("completed replay and a concurrent claim never call parsing or AI providers", async () => {
  const replay = fixture();
  replay.repository.claim = async () => ({
    kind: "complete",
    result: { ...result, reused: true },
  });
  assert.deepEqual(
    await createIngestor(replay.dependencies)({
      ...input,
      filename: "renamed.md",
    }),
    { ...result, reused: true },
  );
  assert.deepEqual(replay.calls, {
    parse: 0,
    extract: 0,
    embed: 0,
    complete: 0,
    fail: 0,
  });
  const busy = fixture();
  busy.repository.claim = async () => ({ kind: "busy", retryAfterSeconds: 17 });
  await assert.rejects(
    createIngestor(busy.dependencies)(input),
    (error) =>
      error instanceof UploadInProgressError && error.retryAfterSeconds === 17,
  );
  assert.deepEqual(busy.calls, {
    parse: 0,
    extract: 0,
    embed: 0,
    complete: 0,
    fail: 0,
  });
});

test("provider failure exposes a safe retry message and never commits partial memory", async () => {
  const f = fixture();
  f.dependencies.extractIntelligence = async () => {
    throw new Error("provider-secret-token should not be returned");
  };
  await assert.rejects(
    createIngestor(f.dependencies)(input),
    (error) =>
      error instanceof IngestionFailedError &&
      !error.message.includes("provider-secret-token"),
  );
  assert.equal(f.calls.complete, 0);
  assert.equal(f.calls.embed, 0);
  assert.equal(f.calls.fail, 1);
});

test("a provider deadline cannot later commit after the timed-out promise finishes", async () => {
  const f = fixture();
  let release!: () => void;
  f.dependencies.extractIntelligence = async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return intelligence;
  };
  await assert.rejects(
    createIngestor({ ...f.dependencies, workTimeoutMs: 15 })(input),
    /took too long/,
  );
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.complete, 0);
  assert.equal(f.calls.embed, 0);
  assert.equal(f.calls.fail, 1);
});

test("a lost lease stops processing before another external stage or final commit", async () => {
  const f = fixture();
  f.repository.renew = async () => false;
  await assert.rejects(
    createIngestor(f.dependencies)(input),
    UploadInProgressError,
  );
  assert.equal(f.calls.extract, 0);
  assert.equal(f.calls.complete, 0);
});

test("invalid embedding output fails without publishing an incomplete index", async () => {
  for (const vectors of [[], [[]], [[NaN]], [[0, 0]], [[1], [1, 2]]]) {
    const f = fixture();
    f.dependencies.embed = async () => vectors;
    await assert.rejects(createIngestor(f.dependencies)(input), /search index/);
    assert.equal(f.calls.complete, 0);
    assert.equal(f.calls.fail, 1);
  }
});
