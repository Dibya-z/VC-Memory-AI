import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MEMORY_CONTEXT_CHARS, recordedSourceDate, selectMemoryEvidence } from "../src/lib/ai/memory-evidence";
import type { MemoryCompany, MemoryDocument, MemoryRepository, QueryPlan } from "../src/lib/ai/memory-contract";

const companies: MemoryCompany[] = ["Alpha", "Beta"].map((name) => ({
  id: name.toLowerCase(), name, sector: "SaaS", decision: "Tracking", decisionReason: null,
  firstMetAt: null, lastMetAt: null, updatedAt: "2026-11-25T00:00:00.000Z",
}));
function document(companyId = "alpha", rawText = "Date: October 2025\nFounders: Ada and Ben.\nRevenue: approximately $9k MRR."): MemoryDocument {
  return { id: `${companyId}-doc`, companyId, companyName: companyId, filename: `${companyId}.txt`,
    docType: "notes", rawText, uploadedAt: "2026-11-25T00:00:00.000Z", chunks: [] };
}
function repository(documents: MemoryDocument[]): MemoryRepository {
  return { catalog: async () => companies, list: async () => companies, count: async () => companies.length,
    documents: async (ids) => documents.filter((doc) => ids.includes(doc.companyId!)) };
}
function plan(overrides: Partial<QueryPlan> = {}): QueryPlan {
  return { intent: "company_recall", companyIds: ["alpha"], filters: {},
    standaloneQuestion: "Who founded Alpha and what is its revenue?", ...overrides };
}
const noEmbed = async (): Promise<number[]> => { throw new Error("Named recall must not embed."); };

test("named company gets complete short sources and a distinct current record without embedding", async () => {
  const source = document();
  const selected = await selectMemoryEvidence(plan(), companies, {
    repository: repository([source, document("beta")]), embed: noEmbed, search: async () => [],
  });
  assert.equal(selected.sufficient, true);
  assert.equal(selected.evidence.filter((e) => e.kind === "document").length, 1);
  const evidence = selected.evidence.find((e) => e.kind === "document")!;
  assert.equal(evidence.text, source.rawText);
  assert.equal(evidence.sourceDate, "October 2025");
  assert.equal(evidence.uploadedAt, "2026-11-25T00:00:00.000Z");
  assert.deepEqual({ start: evidence.start, end: evidence.end }, { start: 0, end: source.rawText.length });
  assert.ok(selected.evidence.some((e) => e.kind === "company_record"));
  assert.ok(selected.evidence.every((e) => e.companyId === "alpha"));
});

test("full FlowAI source includes founders and conditions near its end", async () => {
  const rawText = readFileSync("data/demo/flowai-notes.txt", "utf8");
  const selected = await selectMemoryEvidence(plan(), companies, {
    repository: repository([document("alpha", rawText)]), embed: noEmbed, search: async () => [],
  });
  const source = selected.evidence.find((e) => e.kind === "document")!;
  for (const text of ["Grace Lin", "Raj Patel", "net revenue retention > 110%", "month-3 retention improving materially", "reliability/observability"]) {
    assert.ok(source.text.includes(text), text);
  }
});

test("comparison budgets cover both companies and relevant tail of a long unstructured source", async () => {
  const rawText = "Generic context. ".repeat(6000) + "\nUnique reliability condition: observability required before investing.";
  const selected = await selectMemoryEvidence(plan({ intent: "comparison", companyIds: ["alpha", "beta"],
    standaloneQuestion: "Compare reliability observability conditions." }), companies, {
    repository: repository([document("alpha", rawText), document("beta", "Beta reliability requires observability.")]),
    embed: noEmbed, search: async () => [],
  });
  assert.ok(selected.evidence.some((e) => e.companyId === "alpha" && e.text.includes("Unique reliability condition")));
  assert.ok(selected.evidence.some((e) => e.companyId === "beta" && e.kind === "document"));
  assert.ok(selected.evidence.reduce((sum, e) => sum + e.text.length, 0) <= MEMORY_CONTEXT_CHARS);
  assert.match(selected.reason, /partial/);
  for (const evidence of selected.evidence.filter((e) => e.kind === "document" && e.companyId === "alpha")) {
    assert.equal(rawText.slice(evidence.start, evidence.end), evidence.text);
  }
});

test("source-specific recall excludes accumulated company decision record and unrelated source types", async () => {
  const deck = { ...document(), id: "deck", docType: "pitch_deck", rawText: "Original pitch with free pilots." };
  const memo = { ...document(), id: "memo", docType: "memo", rawText: "Later memo recommends investing." };
  const selected = await selectMemoryEvidence(plan({ standaloneQuestion: "What decision does the original Alpha deck record?" }), companies, {
    repository: repository([memo, deck]), embed: noEmbed, search: async () => [],
  });
  assert.equal(selected.evidence.length, 1);
  assert.ok(selected.evidence.every((e) => e.kind === "document"));
  assert.equal(selected.evidence[0].documentId, "deck");
  const memoOnly = await selectMemoryEvidence(plan({ standaloneQuestion: "What does Alpha's memo record?" }), companies, {
    repository: repository([memo, deck]), embed: noEmbed, search: async () => [],
  });
  assert.equal(memoOnly.evidence.length, 1);
  assert.equal(memoOnly.evidence[0].documentId, "memo");
});

test("multiple matching decks do not infer original identity from upload timestamps", async () => {
  const olderUpload = { ...document(), id: "a", docType: "pitch_deck", uploadedAt: "2025-01-01T00:00:00.000Z" };
  const newerUpload = { ...document(), id: "b", docType: "pitch_deck", uploadedAt: "2026-11-25T00:00:00.000Z" };
  const selected = await selectMemoryEvidence(plan({ standaloneQuestion: "What does the original Alpha deck record?" }), companies, {
    repository: repository([newerUpload, olderUpload]), embed: noEmbed, search: async () => [],
  });
  assert.equal(selected.evidence.length, 2);
  assert.match(selected.reason, /Original source identity is not established/);
});

test("nearest neighbors alone are insufficient even with very high cosine similarity", async () => {
  const selected = await selectMemoryEvidence(plan({ intent: "semantic_explanation", companyIds: [],
    standaloneQuestion: "Have we seen robotics hardware?" }), companies, {
    repository: repository([document()]), embed: async () => [1], search: async () => [{
      chunkId: "chunk", documentId: "alpha-doc", companyId: "alpha", companyName: "Alpha",
      content: "Accounting revenue and ledger technology.", score: 0.99,
    }],
  });
  assert.equal(selected.sufficient, false);
  assert.deepEqual(selected.evidence, []);
});

test("semantic candidates require corroboration and retain source identity", async () => {
  const selected = await selectMemoryEvidence(plan({ intent: "semantic_explanation", companyIds: [],
    standaloneQuestion: "Have we seen AI coding assistants?" }), companies, {
    repository: repository([document("alpha", "An AI pair-programmer in your IDE."), document("beta")]),
    embed: async () => [1], search: async () => [{ chunkId: "chunk", documentId: "alpha-doc",
      companyId: "alpha", companyName: "Alpha", content: "An AI pair-programmer in your IDE.", score: 0.2 }],
  });
  assert.equal(selected.sufficient, true);
  assert.ok(selected.evidence.every((e) => e.companyId === "alpha"));
});

test("source date is never inferred from an upload or arbitrary year in prose", () => {
  assert.equal(recordedSourceDate("Revenue may reach scale in 2028."), null);
  assert.equal(recordedSourceDate("**Date:** July 2025\nRevenue"), "July 2025");
});
