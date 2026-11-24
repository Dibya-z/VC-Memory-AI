import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFromMemory, type MemoryChatDependencies } from "../src/lib/ai/chat";
import type { MemoryCompany } from "../src/lib/ai/memory-contract";
import {
  fixtureCompanies, fixtureDependencies, type FixtureClaim,
} from "./fixtures/memory";

/** Spies wrap the fixture repository/provider seams, while the production
 * planner, evidence selection, orchestration and citation validator all run. */
function observedDependencies(claims: FixtureClaim[] = [], companies = fixtureCompanies) {
  const deps = fixtureDependencies(claims, { companies });
  const calls = { list: 0, count: 0, documents: 0, embed: 0, search: 0, generate: 0 };
  const repository = deps.repository!;
  deps.repository = {
    ...repository,
    list: async (filters) => { calls.list++; return repository.list(filters); },
    count: async (filters) => { calls.count++; return repository.count(filters); },
    documents: async (ids) => { calls.documents++; return repository.documents(ids); },
  };
  const generate = deps.generate!;
  deps.generate = async (...args) => { calls.generate++; return generate(...args); };
  const embed = deps.embed!, search = deps.search!;
  deps.embed = async (question) => { calls.embed++; return embed(question); };
  deps.search = async (...args) => { calls.search++; return search(...args); };
  return { deps, calls };
}

function assertNoQueriesOrProviders(calls: ReturnType<typeof observedDependencies>["calls"]) {
  assert.deepEqual(calls, { list: 0, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
}

for (const question of [
  "List companies we haven't invested in",
  "List companies we haven’t invested in",
  "List companies we didn't pass on",
  "List companies we didn’t pass on",
  "List companies we aren't tracking",
  "List companies we aren’t tracking",
]) {
  test(`PR #1 decision negation never selects its positive: ${question}`, async () => {
    const { deps, calls } = observedDependencies();
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "clarification", result.answer);
    assert.equal(result.trace.plan.intent, "clarification");
    assert.deepEqual(result.citations, []);
    assert.equal(result.trace.exactQuery, undefined);
    assertNoQueriesOrProviders(calls);
  });
}

test("PR #1 affirmative decision filtering still returns only invested companies", async () => {
  const { deps, calls } = observedDependencies();
  const result = await answerFromMemory("List companies we have invested in", deps);
  assert.equal(result.status, "complete");
  assert.deepEqual(result.trace.plan.filters, { decision: "Invested" });
  assert.match(result.answer, /LedgerLite: Invested/);
  assert.match(result.answer, /Total companies: 1\b/);
  assert.deepEqual(result.citations.map((citation) => citation.companyId), ["ledger"]);
  assert.equal(calls.list, 1);
  assert.equal(calls.count + calls.embed + calls.search + calls.generate, 0);
});

function datedCompany(id: string, name: string, lastMetAt: string | null): MemoryCompany {
  return { ...fixtureCompanies[0], id, name, firstMetAt: lastMetAt, lastMetAt };
}
const rangedCompanies = [
  ...fixtureCompanies,
  datedCompany("range-before", "Earlier Example", "2024-12-31T23:59:59.999Z"),
  datedCompany("range-start", "First Day Example", "2025-01-01T00:00:00.000Z"),
  datedCompany("range-end", "Final Day Example", "2025-06-30T23:59:59.999Z"),
  datedCompany("range-after", "Later Example", "2025-07-01T00:00:00.000Z"),
  datedCompany("range-undated", "Undated Example", null),
];
for (const question of [
  "List companies met between 2025-01-01 and 2025-06-30",
  "List companies met from 2025-01-01 to 2025-06-30",
]) {
  test(`PR #1 date ranges constrain actual list results: ${question}`, async () => {
    const { deps, calls } = observedDependencies([], rangedCompanies);
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.equal(result.trace.plan.intent, "filtered_list");
    assert.deepEqual(result.trace.plan.filters, {
      metAfter: "2025-01-01T00:00:00.000Z", metBefore: "2025-06-30T23:59:59.999Z",
    });
    assert.deepEqual(result.citations.map((citation) => citation.companyId), ["range-start", "range-end"]);
    assert.match(result.answer, /Total companies: 2\b/);
    assert.doesNotMatch(result.answer, /Earlier Example|Later Example|Undated Example|LedgerLite|FlowAI/);
    assert.equal(calls.list, 1);
    assert.equal(calls.count + calls.embed + calls.search + calls.generate, 0);
  });
}

for (const question of [
  "List companies met between January and June 2025",
  "List companies met between 2025-06-30 and 2025-01-01",
  "List companies met between 2025-01-01 and",
  "List companies met since 2025-01-01 and before sometime in June",
  "List companies met in June",
  "List companies met on Monday",
]) {
  test(`PR #1 unsupported date wording never broadens a list: ${question}`, async () => {
    const { deps, calls } = observedDependencies([], rangedCompanies);
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "clarification", result.answer);
    assert.equal(result.trace.exactQuery, undefined);
    assertNoQueriesOrProviders(calls);
  });
}

for (const question of [
  "How many documents are stored in memory?",
  "How many chunks are stored in memory?",
  "How many founders are stored in memory?",
  "How many documents do we have for CodeFlow AI?",
  "How many founders does FlowAI have?",
  "How many companies and documents are stored in memory?",
  "number of documents",
  "How many companies have documents?",
  "How many companies with no documents?",
]) {
  test(`PR #1 unsupported count requests never become unfiltered company counts: ${question}`, async () => {
    const { deps, calls } = observedDependencies();
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "clarification", result.answer);
    assert.equal(result.trace.exactQuery, undefined);
    assert.doesNotMatch(result.answer, /Total companies: 5/);
    assertNoQueriesOrProviders(calls);
  });
}

for (const noun of ["companies", "startups", "deals"]) {
  test(`PR #1 supported ${noun} count still uses the exact repository operation`, async () => {
    const { deps, calls } = observedDependencies();
    const result = await answerFromMemory(`How many ${noun} are stored in memory?`, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.equal(result.trace.plan.intent, "count");
    assert.deepEqual(result.trace.exactQuery, { operation: "count", rowCount: 5 });
    assert.match(result.answer, /Total companies in memory: 5\./);
    assert.equal(calls.count, 1);
    assert.equal(calls.list + calls.documents + calls.embed + calls.search + calls.generate, 0);
  });
}

for (const scenario of [
  { question: "List All Companies", intent: "inventory", companyIds: fixtureCompanies.map((company) => company.id) },
  { question: "How Many Companies Are In Memory?", intent: "count", companyIds: [] },
  { question: "Show All Passed Companies", intent: "filtered_list", companyIds: ["code"] },
]) {
  test(`PR #1 capitalized collections retain exact routing: ${scenario.question}`, async () => {
    const { deps, calls } = observedDependencies();
    const result = await answerFromMemory(scenario.question, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.equal(result.trace.plan.intent, scenario.intent);
    assert.equal(result.trace.plan.unknownCompany, undefined);
    assert.deepEqual(result.citations.map((citation) => citation.companyId), scenario.companyIds);
    if (scenario.intent === "count") {
      assert.equal(calls.count, 1);
      assert.equal(calls.list, 0);
      assert.match(result.answer, /Total companies in memory: 5\./);
    } else {
      assert.equal(calls.list, 1);
      assert.equal(calls.count, 0);
      assert.match(result.answer, new RegExp(`Total companies: ${scenario.companyIds.length}\\b`));
    }
    assert.equal(calls.documents + calls.embed + calls.search + calls.generate, 0);
  });
}

for (const question of [
  "What are the Key Risks for CodeFlow AI?",
  "What are the Business Model and Key Risks for CodeFlow AI?",
  "Tell me about the Key Risks for CodeFlow AI.",
  "What are CodeFlow AI's Founding Team and Business Model?",
  "What are CodeFlow AI's Core Risks?",
]) {
  test(`PR #1 capitalized business concepts preserve the known company: ${question}`, async () => {
    const { deps, calls } = observedDependencies([{
      text: "CodeFlow AI had weak team/seat adoption.", companyId: "code", quote: "**Weak team/seat adoption**",
    }]);
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.equal(result.trace.plan.unknownCompany, undefined);
    assert.deepEqual(result.trace.plan.companyIds, ["code"]);
    assert.equal(result.activeCompanyId, "code");
    assert.match(result.answer, /weak team\/seat adoption/);
    assert.ok(result.trace.evidenceIds.every((id) => id.includes("code")));
    assert.deepEqual(result.citations.map((citation) => citation.companyId), ["code"]);
    assert.equal(calls.documents, 1);
    assert.equal(calls.generate, 1);
    assert.equal(calls.list + calls.count + calls.embed + calls.search, 0);
  });
}

for (const question of [
  "Compare CodeFlow AI and Orchid Robotics on Key Risks.",
  "Compare Orchid Robotics and CodeFlow AI on Key Risks.",
  "What are the Key Risks for Orchid Robotics?",
  "Compare Key Risks between CodeFlow AI and Orchid Robotics",
  "What are the Key Risks for CodeFlow AI, as opposed to Orchid Robotics?",
]) {
  test(`PR #1 genuine unknown companies remain detectable: ${question}`, async () => {
    const { deps, calls } = observedDependencies();
    const result = await answerFromMemory(question, deps);
    assert.ok(["insufficient_evidence", "clarification"].includes(result.status), result.answer);
    assert.match(result.answer, /Orchid Robotics/i);
    assert.equal(result.activeCompanyId, null);
    assert.deepEqual(result.citations, []);
    assertNoQueriesOrProviders(calls);
  });
}

function generatedBlock(text: string, options: { kind?: "unknown" | "fact"; supports?: { evidenceId: string; quote: string }[] } = {}): MemoryChatDependencies["generate"] {
  return async () => ({
    text: JSON.stringify({ blocks: [{ kind: options.kind ?? "unknown", text, supports: options.supports ?? [] }] }),
    configuredModel: "fixture-provider", returnedModel: "fixture-provider-v1", finishReason: "stop",
  });
}
for (const text of [
  "No updated document is available in memory.",
  "No later memo is recorded in memory.",
  "No follow-up notes are available in memory.",
  "An updated document is not available in memory.",
]) {
  test(`PR #1 valid missing-source generation remains complete: ${text}`, async () => {
    const { deps, calls } = observedDependencies();
    const generate = generatedBlock(text);
    deps.generate = async (...args) => { calls.generate++; return generate(...args); };
    const result = await answerFromMemory("What changed in FlowAI's retention after our October 2025 meeting?", deps);
    assert.equal(result.status, "complete", result.answer);
    assert.ok(result.answer.includes(text));
    assert.deepEqual(result.citations, []);
    assert.equal(calls.documents, 1);
    assert.equal(calls.generate, 1);
    assert.equal(calls.list + calls.count + calls.embed + calls.search, 0);
  });
}

for (const text of [
  "A later memo says FlowAI doubled revenue.",
  "No updated document is available in memory. A later memo says revenue doubled.",
  "No updated document is available in memory, but a later memo says revenue doubled.",
]) {
  test(`PR #1 missing-source allowance cannot authorize fabricated later sources: ${text}`, async () => {
    const { deps } = observedDependencies();
    deps.generate = generatedBlock(text);
    const result = await answerFromMemory("What changed in FlowAI's retention after our October 2025 meeting?", deps);
    assert.equal(result.status, "invalid_response", result.answer);
    assert.deepEqual(result.citations, []);
    assert.ok(!result.answer.includes("doubled"));
  });
}

for (const supports of [
  [{ evidenceId: "invented", quote: "No updated document is available in memory." }],
  [{ evidenceId: "company:flow", quote: "No updated document is available in memory." }],
]) {
  test(`PR #1 absence wording cannot bypass invalid evidence: ${supports[0].evidenceId}`, async () => {
    const { deps } = observedDependencies();
    deps.generate = generatedBlock("No updated document is available in memory.", { supports });
    const result = await answerFromMemory("What changed in FlowAI's retention after our October 2025 meeting?", deps);
    assert.equal(result.status, "invalid_response");
    assert.deepEqual(result.citations, []);
  });
}
