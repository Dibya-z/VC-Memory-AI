import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFromMemory } from "../src/lib/ai/chat";
import { planMemoryQuery } from "../src/lib/ai/memory-plan";
import type { MemoryCompany, MemoryFilters } from "../src/lib/ai/memory-contract";
import { fixtureCompanies, fixtureDependencies } from "./fixtures/memory";

/** The repository is mocked; planning, exact result formatting, and citations run normally. */
function observed(companies = fixtureCompanies) {
  const deps = fixtureDependencies([], { companies });
  const calls = { list: 0, count: 0, documents: 0, embed: 0, search: 0, generate: 0 };
  const filters: MemoryFilters[] = [];
  const repository = deps.repository!;
  deps.repository = {
    ...repository,
    list: async (where) => { calls.list++; filters.push(where); return repository.list(where); },
    count: async (where) => { calls.count++; filters.push(where); return repository.count(where); },
    documents: async (ids) => { calls.documents++; return repository.documents(ids); },
  };
  const embed = deps.embed!, search = deps.search!, generate = deps.generate!;
  deps.embed = async (...args) => { calls.embed++; return embed(...args); };
  deps.search = async (...args) => { calls.search++; return search(...args); };
  deps.generate = async (...args) => { calls.generate++; return generate(...args); };
  return { deps, calls, filters };
}

for (const message of [
  "List companies whose last interaction was not between 2025-07-01 and 2025-08-31",
  "List companies we have not met between 2025-07-01 and 2025-08-31",
  "List companies we haven't met between 2025-07-01 and 2025-08-31",
  "List companies we haven’t met during July 2025",
  "List companies whose last interaction hasn't been in July 2025",
  "List companies whose last interaction hasn’t been in July 2025",
  "List companies whose last interaction wasn't from 2025-07-01 to 2025-08-31",
  "List companies whose last interaction wasn’t from 2025-07-01 to 2025-08-31",
  "List companies not met from 2025-07-01 to 2025-08-31",
  "List companies not in July 2025",
  "List companies not during July 2025",
  "List companies whose last interaction was never in July 2025",
  "List companies whose last interaction wasn't during July 2025",
  "List companies we didn't meet in July 2025",
  "List companies we didn’t meet during July 2025",
  "List companies whose last interaction wasn't actually between 2025-07-01 and 2025-08-31",
  "List companies we didn't meet with between 2025-07-01 and 2025-08-31",
  "List companies we haven't interacted with during July 2025",
  "List companies whose last interaction hasn't ever officially been recorded as having actually taken place during July 2025",
  "List companies outside the date range between 2025-07-01 and 2025-08-31",
  "List companies whose last interaction was outside July 2025",
  "List companies excluding July 2025",
  "List companies without any recorded interaction in July 2025",
  "List companies whose last interaction was neither in July 2025 nor August 2025",
  "How many companies were not met between 2025-07-01 and 2025-08-31?",
]) {
  test(`negated interaction dates clarify before a positive query: ${message}`, async () => {
    const plan = planMemoryQuery({ message }, fixtureCompanies);
    assert.equal(plan.intent, "clarification");
    assert.deepEqual(plan.filters, {});
    assert.match(plan.clarification!, /Negated interaction date filters/);

    const { deps, calls, filters } = observed();
    const result = await answerFromMemory(message, deps);
    assert.equal(result.status, "clarification", result.answer);
    assert.deepEqual(result.trace.plan.filters, {});
    assert.equal(result.trace.exactQuery, undefined);
    assert.deepEqual(result.citations, []);
    assert.deepEqual(filters, []);
    assert.deepEqual(calls, { list: 0, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
  });
}

function dated(id: string, lastMetAt: string | null, firstMetAt: string | null): MemoryCompany {
  return { ...fixtureCompanies[0], id, name: `Date Boundary ${id}`, lastMetAt, firstMetAt };
}
const datedCompanies = [
  ...fixtureCompanies,
  dated("before", "2025-06-30T23:59:59.999Z", "2025-08-01T00:00:00.000Z"),
  dated("start", "2025-07-01T00:00:00.000Z", "2019-01-01T00:00:00.000Z"),
  dated("end", "2025-08-31T23:59:59.999Z", "2025-09-15T00:00:00.000Z"),
  dated("after", "2025-09-01T00:00:00.000Z", "2025-07-15T00:00:00.000Z"),
  dated("undated", null, "2025-07-15T00:00:00.000Z"),
];

for (const message of [
  "List companies whose last interaction was between 2025-07-01 and 2025-08-31",
  "List companies met from July 2025 through August 2025",
  "List companies met between 2025-07-01 and 2025-08-31; do not infer missing facts.",
  "List companies met between 2025-07-01 and 2025-08-31 and do not infer decisions.",
]) {
  test(`affirmative ranges retain inclusive lastMetAt results: ${message}`, async () => {
    const { deps, calls, filters } = observed(datedCompanies);
    const result = await answerFromMemory(message, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.deepEqual(filters, [{ metAfter: "2025-07-01T00:00:00.000Z", metBefore: "2025-08-31T23:59:59.999Z" }]);
    assert.deepEqual(result.citations.map((citation) => citation.companyId), ["cloud", "ledger", "start", "end"]);
    assert.match(result.answer, /Total companies: 4\b/);
    assert.doesNotMatch(result.answer, /Date Boundary (before|after|undated)/);
    assert.deepEqual(calls, { list: 1, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
  });
}

test("affirmative range count uses the same lastMetAt bounds", async () => {
  const { deps, calls, filters } = observed(datedCompanies);
  const result = await answerFromMemory("How many companies were met between 2025-07-01 and 2025-08-31?", deps);
  assert.equal(result.status, "complete", result.answer);
  assert.deepEqual(filters, [{ metAfter: "2025-07-01T00:00:00.000Z", metBefore: "2025-08-31T23:59:59.999Z" }]);
  assert.match(result.answer, /Total companies matching the recorded filters: 4\./);
  assert.deepEqual(calls, { list: 0, count: 1, documents: 0, embed: 0, search: 0, generate: 0 });
});

test("an empty affirmative date range stays an exact complete empty inventory", async () => {
  const { deps, calls } = observed(datedCompanies);
  const result = await answerFromMemory("List companies met between 2030-01-01 and 2030-01-31", deps);
  assert.equal(result.status, "complete", result.answer);
  assert.match(result.answer, /No companies match these recorded filters/);
  assert.match(result.answer, /Total companies: 0\b/);
  assert.deepEqual(result.citations, []);
  assert.deepEqual(calls, { list: 1, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
});

for (const message of [
  "List companies met between 2025-07-01 and 2025-02-30",
  "List companies met from 2025-08-31 to 2025-07-01",
  "List companies met between July and August 2025",
]) {
  test(`invalid affirmative dates still clarify without querying: ${message}`, async () => {
    const { deps, calls } = observed(datedCompanies);
    const result = await answerFromMemory(message, deps);
    assert.equal(result.status, "clarification", result.answer);
    assert.deepEqual(result.trace.plan.filters, {});
    assert.deepEqual(calls, { list: 0, count: 0, documents: 0, embed: 0, search: 0, generate: 0 });
  });
}
