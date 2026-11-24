import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryCompanyWhere, memoryRepository } from "../src/lib/ai/memory-repository";

test("repository maps only allowed current-record filters into typed Prisma where", () => {
  assert.deepEqual(memoryCompanyWhere({}), {});
  assert.deepEqual(memoryCompanyWhere({ sector: "Fintech", decision: "Passed" }), {
    sector: { equals: "Fintech", mode: "insensitive" }, decision: "Passed",
  });
  const after = "2025-01-01T00:00:00.000Z", before = "2025-12-31T23:59:59.999Z";
  assert.deepEqual(memoryCompanyWhere({ metAfter: after, metBefore: before }), {
    lastMetAt: { gte: new Date(after), lte: new Date(before) },
  });
  assert.deepEqual(memoryCompanyWhere({ sql: "DROP TABLE Company" } as never), {});
});

test("empty document scope never becomes an unrestricted database scan", async () => {
  assert.deepEqual(await memoryRepository.documents([]), []);
});
