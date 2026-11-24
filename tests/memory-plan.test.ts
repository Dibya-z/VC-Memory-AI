import assert from "node:assert/strict";
import { test } from "node:test";
import { planMemoryQuery, queryPlanSchema } from "../src/lib/ai/memory-plan";
import type { MemoryCompany } from "../src/lib/ai/memory-contract";

const company = (id: string, name: string, sector: string): MemoryCompany => ({ id, name, sector, decision: null, decisionReason: null, firstMetAt: null, lastMetAt: null, updatedAt: "2026-01-01T00:00:00.000Z" });
const catalog = [company("flow", "FlowAI", "SaaS"), company("code", "CodeFlow AI", "Developer Tools"), company("ledger", "LedgerLite", "Fintech")];
const plan = (message: string, history: { role: "user" | "assistant"; content: string }[] = [], activeCompanyId?: string) => planMemoryQuery({ message, history, activeCompanyId }, catalog);

test("routes exact inventory without deriving company IDs from retrieval", () => {
  const result = plan('List every company currently in our memory and its recorded investment decision, then give the total company count. Say "not recorded" where no decision is recorded; do not infer a decision from a pitch deck.');
  assert.equal(result.intent, "inventory");
  assert.deepEqual(result.companyIds, []);
  assert.deepEqual(result.filters, {});
});

test("count and filtered lists preserve allowlisted filters", () => {
  assert.equal(plan("How many companies are in memory?").intent, "count");
  assert.equal(plan("Count all companies").intent, "count");
  const result = plan("Which startups did we pass on, and why?");
  assert.equal(result.intent, "filtered_list");
  assert.deepEqual(result.filters, { decision: "Passed" });
  assert.deepEqual(plan("List companies in Developer Tools").filters, { sector: "Developer Tools" });
  assert.equal(plan("Summarize what we know in Developer Tools.").intent, "semantic_explanation");
  assert.deepEqual(plan("Summarize what we know in Developer Tools.").filters, { sector: "Developer Tools" });
});

test("catalog names, compact names and safe omitted AI suffix match without FlowAI suffix collisions", () => {
  assert.deepEqual(plan("Who founded CodeFlow AI?").companyIds, ["code"]);
  assert.deepEqual(plan("Who founded CodeFlowAI?").companyIds, ["code"]);
  assert.deepEqual(plan("Who founded CodeFlow?").companyIds, ["code"]);
  assert.deepEqual(plan("Who founded FlowAI?").companyIds, ["flow"]);
});

test("uses current-record filters only for broad requests, preserving source time questions", () => {
  assert.deepEqual(plan("What changed in FlowAI's retention after our October 2025 meeting?").filters, {});
  assert.deepEqual(plan("Since we invested in CodeFlow AI, why did we overlook its weak founders?").filters, {});
  assert.equal(plan("Prepare me for a follow-up meeting with FlowAI").intent, "meeting_preparation");
});

test("supports UTC last-interaction ISO, month and year periods", () => {
  assert.deepEqual(plan("List companies met after October 2025").filters, { metAfter: "2025-11-01T00:00:00.000Z" });
  assert.deepEqual(plan("List companies met since October 2025").filters, { metAfter: "2025-10-01T00:00:00.000Z" });
  assert.deepEqual(plan("List companies met before 2025-10-03").filters, { metBefore: "2025-10-02T23:59:59.999Z" });
  assert.deepEqual(plan("List companies met in 2025").filters, { metAfter: "2025-01-01T00:00:00.000Z", metBefore: "2025-12-31T23:59:59.999Z" });
  assert.deepEqual(plan("List companies met in October 2025").filters, { metAfter: "2025-10-01T00:00:00.000Z", metBefore: "2025-10-31T23:59:59.999Z" });
});

test("ambiguous or unsupported dates and filters ask focused clarification", () => {
  for (const question of ["List companies met last quarter", "List companies met after 2025-02-30", "List companies met after 2026 before 2025", "List companies with ARR above $1M", "List companies at seed stage", "List companies in SpaceTech", "List companies in Fintech and SaaS", "List passed and invested companies"]) {
    assert.equal(plan(question).intent, "clarification", question);
  }
});

test("resolves user-history pronouns to standalone question, ignoring assistant facts", () => {
  const result = plan("Who founded it, and what would make us lean in?", [
    { role: "user", content: "Prepare me for a meeting with FlowAI" },
    { role: "assistant", content: "CodeFlow AI was founded by invented people." },
  ]);
  assert.equal(result.intent, "company_recall");
  assert.deepEqual(result.companyIds, ["flow"]);
  assert.match(result.standaloneQuestion, /FlowAI/);
  assert.doesNotMatch(result.standaloneQuestion, /invented people/);
});

test("reference context remains request-scoped", () => {
  assert.deepEqual(plan("Who founded it?", [{ role: "user", content: "Tell me about FlowAI" }]).companyIds, ["flow"]);
  assert.equal(plan("Who founded it?").intent, "clarification");
  assert.deepEqual(plan("Who founded it?", [], "ledger").companyIds, ["ledger"]);
  assert.equal(plan("Who founded it?", [], "missing").intent, "clarification");
});

test("explicit topic changes override prior context and active reference", () => {
  assert.deepEqual(plan("What is LedgerLite's revenue?", [{ role: "user", content: "Tell me about FlowAI" }], "flow").companyIds, ["ledger"]);
  const unknown = plan("What was our decision on Orchid Robotics, and who founded it?", [{ role: "user", content: "Tell me about FlowAI" }], "flow");
  assert.equal(unknown.unknownCompany, "Orchid Robotics");
  assert.deepEqual(unknown.companyIds, []);
  assert.equal(plan("Tell me about Nimbus").unknownCompany, "Nimbus");
  assert.equal(plan("Who founded orchid robotics?", [{ role: "user", content: "Tell me about FlowAI" }]).unknownCompany, "orchid robotics");
  assert.equal(plan("Who founded it?", [{ role: "user", content: "Tell me about Orchid Robotics" }], "flow").intent, "clarification");
});

test("comparison antecedents are plural only for explicit comparisons", () => {
  const history = [{ role: "user" as const, content: "Compare CodeFlow AI and FlowAI" }];
  assert.equal(plan("Who founded it?", history, "flow").intent, "clarification");
  assert.deepEqual(plan("Compare their retention", history).companyIds, ["flow", "code"]);
  assert.deepEqual(plan("Compare it with CodeFlow AI", [{ role: "user", content: "Tell me about FlowAI" }]).companyIds, ["flow", "code"]);
});

test("partial entity names shared by several companies request clarification", () => {
  const result = planMemoryQuery({ message: "Tell me about Atlas" }, [company("a", "Atlas Cloud", "SaaS"), company("b", "Atlas Data", "SaaS")]);
  assert.equal(result.intent, "clarification");
  assert.match(result.clarification!, /Atlas Cloud/);
  assert.match(result.clarification!, /Atlas Data/);
  const overlapping = planMemoryQuery({ message: "Who founded Acme AI?" }, [company("acme", "Acme", "SaaS"), company("acme-ai", "Acme AI", "SaaS")]);
  assert.equal(overlapping.intent, "clarification");
});

test("negated, OR, null-decision and qualitative constraints cannot silently broaden", () => {
  for (const question of ["List companies not Passed", "List companies we did not pass on", "List companies except Invested", "List Fintech or SaaS companies", "List companies not in SaaS", "List companies outside Fintech", "List companies in 2025 or 2026", "List companies not before 2025", "List companies uploaded after October 2025", "What companies changed their decision in October 2025?", "List companies with no recorded decision", "Which AI startups did we pass on for GTM concerns?", "Which companies have strong founders?"]) {
    assert.equal(plan(question).intent, "clarification", question);
  }
  assert.equal(plan("AI startups passed on for GTM concerns").intent, "semantic_explanation");
});

test("sector labels differing only in case do not create false ambiguity", () => {
  const result = planMemoryQuery({ message: "List SaaS companies" }, [company("one", "Example", "saas")]);
  assert.equal(result.intent, "filtered_list");
  assert.equal(result.filters.sector?.toLowerCase(), "saas");
});

test("semantic explanations remain available, and plans reject arbitrary fields", () => {
  assert.equal(plan("Have we seen any AI coding assistants before?").intent, "semantic_explanation");
  assert.equal(queryPlanSchema.safeParse({ ...plan("Tell me about FlowAI"), sql: "DROP TABLE Company" }).success, false);
  assert.equal(queryPlanSchema.safeParse({ ...plan("Tell me about FlowAI"), filters: { arbitrary: true } }).success, false);
});

for (const question of [
  "List companies we haven't invested in", "List companies we haven’t invested in",
  "List companies we haven‘t invested in", "List companies we havenʼt yet invested in",
  "List companies we didn't pass on", "List companies we didn’t pass on",
  "List companies we weren't interested in", "List companies we weren’t interested in",
  "List companies we aren't tracking", "List companies we aren’t tracking",
  "List companies we’ve never invested in", "List companies we ain't tracking",
]) {
  test(`negative decision contraction clarifies instead of selecting an opposite: ${question}`, () => {
    const result = plan(question);
    assert.equal(result.intent, "clarification");
    assert.equal(result.filters.decision, undefined);
  });
}

test("decision negation preserves affirmative filters and literal company apostrophes", () => {
  assert.deepEqual(plan("List companies we have invested in").filters, { decision: "Invested" });
  assert.deepEqual(plan("List companies we were interested in").filters, { decision: "Interested" });
  const result = planMemoryQuery({ message: "What are Founder’s AI's risks?" }, [company("apostrophe", "Founder’s AI", "SaaS")]);
  assert.equal(result.intent, "company_recall");
  assert.deepEqual(result.companyIds, ["apostrophe"]);
});

for (const [question, start, end] of [
  ["List companies met between 2025-01-01 and 2025-06-30", "2025-01-01T00:00:00.000Z", "2025-06-30T23:59:59.999Z"],
  ["List companies met from 2025-01-01 to 2025-06-30", "2025-01-01T00:00:00.000Z", "2025-06-30T23:59:59.999Z"],
  ["List companies met between January 2025 and June 2025", "2025-01-01T00:00:00.000Z", "2025-06-30T23:59:59.999Z"],
  ["List companies met from 2024 through 2025", "2024-01-01T00:00:00.000Z", "2025-12-31T23:59:59.999Z"],
  ["List companies met from 2025 until 2026", "2025-01-01T00:00:00.000Z", "2026-12-31T23:59:59.999Z"],
] as const) {
  test(`inclusive interaction range retains both bounds: ${question}`, () => {
    const result = plan(question);
    assert.equal(result.intent, "filtered_list");
    assert.deepEqual(result.filters, { metAfter: start, metBefore: end });
  });
}

for (const question of [
  "List companies met between January and June 2025", "List companies met between 2025-01-01 and",
  "List companies met between 2025-06-30 and 2025-01-01", "List companies met from 2025-01-01 to 2025-02-30",
  "List companies met after 2025-01-01 before March", "List companies met since 2025-01-01 and before sometime in June",
  "List companies met in 2025 and 2026", "List companies met in 2025-1-1", "List companies met 2025-01-01 - 2025-06-30",
  "List companies met in June", "List companies met on Monday", "List companies met on the fifth of July",
  "List companies met yesterday", "List companies met from winter to spring",
]) {
  test(`unconsumed or invalid date constraints clarify: ${question}`, () => {
    const result = plan(question);
    assert.equal(result.intent, "clarification");
    assert.deepEqual(result.filters, {});
  });
}

test("multiple valid date constraints intersect without overwriting the tighter bound", () => {
  assert.deepEqual(plan("List companies met since 2025-04-01 since 2025-01-01 before 2025-10-01").filters, {
    metAfter: "2025-04-01T00:00:00.000Z", metBefore: "2025-09-30T23:59:59.999Z",
  });
});

for (const question of [
  "How many documents are stored in memory?", "How many Documents for CodeFlow AI?", "How many chunks are there?",
  "How many founders does FlowAI have?", "How many companies and documents are in memory?", "Count all documents",
  "What is the document count?", "Count FlowAI documents", "What is the number of documents in memory?",
  "What is the total of chunks in memory?", "How many companies have documents?", "How many companies with no documents?",
]) {
  test(`unsupported count targets or predicates never become company counts: ${question}`, () => {
    assert.equal(plan(question).intent, "clarification");
  });
}

for (const question of [
  "How many companies are in memory?", "How Many Companies Are In Memory?", "How many startups do we have?",
  "How many deals are there?", "Count all companies", "What is the company count?", "What is the number of companies in memory?",
]) {
  test(`supported company tally retains its count target: ${question}`, () => {
    const result = plan(question);
    assert.equal(result.intent, "count");
    assert.deepEqual(result.filters, {});
  });
}

for (const question of [
  "What are the Key Risks for CodeFlow AI?", "What are the Business Model and Key Risks for CodeFlow AI?",
  "What are CodeFlow AI's Founding Team and Business Model?", "What are the Core Risks for CodeFlow AI?",
  "Who founded CodeFlow AI and what are its Key Risks?", "Tell me about the Enterprise Valuation for CodeFlow AI.",
]) {
  test(`capitalized topics do not override a company resolved in an entity position: ${question}`, () => {
    const result = plan(question);
    assert.equal(result.intent, "company_recall");
    assert.deepEqual(result.companyIds, ["code"]);
    assert.equal(result.unknownCompany, undefined);
  });
}

for (const question of [
  "Compare CodeFlow AI and Orchid Robotics on Key Risks.", "Compare Orchid Robotics and CodeFlow AI on Key Risks.",
  "Compare CodeFlow AI with Orchid Robotics on Key Risks.", "Compare Orchid Robotics with CodeFlow AI on Key Risks.",
  "Compare Key Risks between CodeFlow AI and Orchid Robotics", "Compare Key Risks between Orchid Robotics and CodeFlow AI",
  "What are the Key Risks for CodeFlow AI, as opposed to Orchid Robotics?", "What are the risks for CodeFlow AI and Orchid Robotics?",
  "What are the risks for Orchid Robotics and CodeFlow AI?", "Orchid Robotics vs CodeFlow AI: compare revenue.",
]) {
  test(`mixed known and unknown references retain the actual unknown operand: ${question}`, () => {
    const result = plan(question);
    assert.equal(result.unknownCompany, "Orchid Robotics");
    assert.deepEqual(result.companyIds, ["code"]);
  });
}

test("capitalized collection nouns stay inventory and filtered list requests", () => {
  assert.equal(plan("List All Companies").intent, "inventory");
  assert.equal(plan("Show All Passed Companies").intent, "filtered_list");
  assert.deepEqual(plan("Show All Passed Companies").filters, { decision: "Passed" });
});
