import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFromMemory } from "../src/lib/ai/chat";
import { planMemoryQuery } from "../src/lib/ai/memory-plan";
import {
  fixtureCompanies, fixtureDependencies, type FixtureClaim,
} from "./fixtures/memory";

function observed(claims: FixtureClaim[] = [], companies = fixtureCompanies) {
  const deps = fixtureDependencies(claims, { companies });
  const calls = { list: 0, count: 0, documents: 0, embed: 0, search: 0, generate: 0 };
  const repository = deps.repository!;
  deps.repository = {
    ...repository,
    list: async (filters) => { calls.list++; return repository.list(filters); },
    count: async (filters) => { calls.count++; return repository.count(filters); },
    documents: async (ids) => { calls.documents++; return repository.documents(ids); },
  };
  const generate = deps.generate!, embed = deps.embed!, search = deps.search!;
  deps.generate = async (...args) => { calls.generate++; return generate(...args); };
  deps.embed = async (question) => { calls.embed++; return embed(question); };
  deps.search = async (...args) => { calls.search++; return search(...args); };
  return { deps, calls };
}

for (const question of [
  "List all companies and show the count.",
  "List all companies and show their count.",
  "List all companies and count them.",
  "List all companies and tell me how many there are.",
  "Show every startup and give the total.",
  "Give the company count and list all companies.",
  "Count all companies and show every company.",
  "List all companies; include the count.",
]) {
  test(`inventory and its same-request total use exact rows: ${question}`, async () => {
    const { deps, calls } = observed();
    const plan = planMemoryQuery({ message: question }, fixtureCompanies);
    assert.equal(plan.intent, "inventory");
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.deepEqual(result.trace.exactQuery, { operation: "list", rowCount: fixtureCompanies.length });
    assert.deepEqual(result.citations.map((citation) => citation.companyId), fixtureCompanies.map((company) => company.id));
    for (const company of fixtureCompanies) assert.ok(result.answer.includes(`${company.name}: ${company.decision ?? "not recorded"}`));
    assert.match(result.answer, /Total companies: 5\./);
    assert.deepEqual(calls, { list: 1, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
  });
}

test("inventory totals track decision/sector subsets, empty results, and an added sixth record", async () => {
  for (const [question, expectedIds] of [
    ["List Passed companies and show their count.", ["code"]],
    ["Show our Fintech companies and show the count.", ["ledger"]],
    ["List Interested companies and show the count.", []],
  ] as const) {
    const { deps, calls } = observed();
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.deepEqual(result.citations.map((citation) => citation.companyId), [...expectedIds]);
    assert.ok(result.answer.includes(`Total companies: ${expectedIds.length}.`));
    assert.deepEqual(calls, { list: 1, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
  }
  const companies = [...fixtureCompanies, { ...fixtureCompanies[0], id: "inventory-extra", name: "Additional Example" }];
  const { deps, calls } = observed([], companies);
  const result = await answerFromMemory("List all companies and show the count.", deps);
  assert.match(result.answer, /Additional Example/);
  assert.match(result.answer, /Total companies: 6\./);
  assert.equal(result.citations.length, 6);
  assert.equal(calls.embed + calls.search + calls.generate + calls.count, 0);
});

for (const question of [
  "What counts as a red flag for CodeFlow AI?",
  "What do we count as a red flag for CodeFlow AI?",
  "Does CodeFlow AI count as a previous investment?",
  "What would count towards a concern for CodeFlow AI?",
]) {
  test(`qualitative count language retrieves the named company's evidence: ${question}`, async () => {
    const { deps, calls } = observed([{
      companyId: "code", text: "CodeFlow AI's recorded concerns include weak team/seat adoption.", quote: "**Weak team/seat adoption**",
    }]);
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.equal(result.trace.plan.intent, "company_recall");
    assert.deepEqual(result.trace.plan.companyIds, ["code"]);
    assert.equal(result.trace.exactQuery, undefined);
    assert.match(result.answer, /weak team\/seat adoption/);
    assert.deepEqual(result.citations.map((citation) => citation.companyId), ["code"]);
    assert.equal(calls.list + calls.count + calls.embed + calls.search, 0);
    assert.equal(calls.documents, 1);
    assert.equal(calls.generate, 1);
  });
}

for (const question of [
  "List all companies and show the document count.",
  "List all companies and count chunks.",
  "List all companies and show the count of documents.",
  "List documents and show the count.",
  "List all companies and count them and their documents.",
  "How many documents are stored in memory?",
  "Show the company count and the document count.",
  "What counts as a concern for CodeFlow AI, and how many documents are stored?",
]) {
  test(`company inventory cannot authorize an incompatible count target: ${question}`, async () => {
    const { deps, calls } = observed();
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "clarification", result.answer);
    assert.equal(result.trace.exactQuery, undefined);
    assert.deepEqual(result.citations, []);
    assert.deepEqual(calls, { list: 0, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
  });
}

for (const question of ["Count all companies", "Show the company count.", "Show the count of companies."]) {
  test(`an explicit count without an inventory still returns the exact total: ${question}`, async () => {
    const { deps, calls } = observed();
    const result = await answerFromMemory(question, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.match(result.answer, /Total companies in memory: 5\./);
    assert.deepEqual(result.trace.exactQuery, { operation: "count", rowCount: 5 });
    assert.deepEqual(calls, { list: 0, count: 1, documents: 0, embed: 0, search: 0, generate: 0 });
  });
}

test("a count noun inside a catalog company name is not a numeric operation", async () => {
  const companies = [...fixtureCompanies, { ...fixtureCompanies[0], id: "count-brand", name: "Customer Count", decision: "Interested" }];
  const { deps, calls } = observed([{
    companyId: "count-brand", text: "Customer Count is recorded as Interested.", quote: "Recorded decision: Interested",
  }], companies);
  const result = await answerFromMemory("Tell me about Customer Count.", deps);
  assert.equal(result.status, "complete", result.answer);
  assert.deepEqual(result.trace.plan.companyIds, ["count-brand"]);
  assert.equal(result.trace.exactQuery, undefined);
  assert.equal(calls.count + calls.list, 0);
  assert.equal(calls.generate, 1);
});
