import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFromMemory } from "../src/lib/ai/chat";
import { planMemoryQuery } from "../src/lib/ai/memory-plan";
import type { MemoryCompany, MemoryDocument } from "../src/lib/ai/memory-contract";
import {
  fixtureCompanies, fixtureDependencies, fixtureDocuments, type FixtureClaim,
} from "./fixtures/memory";

const codeClaim: FixtureClaim = {
  text: "CodeFlow AI was Passed; the founding team was excellent.",
  companyId: "code", quote: "**PASS.** The team is excellent",
};
const flowClaim: FixtureClaim = {
  text: "FlowAI was Tracking, with month-2 retention around 55%.",
  companyId: "flow", quote: "RETENTION: month-2 retention around 55%.",
};

for (const scenario of [
  { message: "Tell me about CodeFlow AI and why we passed.", ids: ["code"], claims: [codeClaim] },
  { message: "Summarize FlowAI and explain our concerns.", ids: ["flow"], claims: [flowClaim] },
  { message: "Compare CodeFlow AI with FlowAI and explain the differences.", ids: ["code", "flow"], claims: [codeClaim, flowClaim] },
  { message: "Tell me about CodeFlow AI and how we reached the decision.", ids: ["code"], claims: [codeClaim] },
  { message: "Summarize FlowAI and tell me what worried us.", ids: ["flow"], claims: [flowClaim] },
  { message: "Summarize FlowAI and what we should ask next.", ids: ["flow"], claims: [flowClaim] },
  { message: "Tell me about CodeFlow AI and describe the recorded decision.", ids: ["code"], claims: [codeClaim] },
  { message: "Tell me about CodeFlow AI and please explain our concerns.", ids: ["code"], claims: [codeClaim] },
  { message: "Summarize FlowAI and Explain Revenue.", ids: ["flow"], claims: [flowClaim] },
  { message: "Compare CodeFlow AI with FlowAI and explain why their positions differ.", ids: ["code", "flow"], claims: [codeClaim, flowClaim] },
  { message: "Compare CodeFlow AI with FlowAI and explain revenue. Keep ARR and MRR separate.", ids: ["code", "flow"], claims: [codeClaim, flowClaim] },
]) {
  test(`coordinated explanation preserves actual evidence and answer: ${scenario.message}`, async () => {
    const plan = planMemoryQuery({ message: scenario.message }, fixtureCompanies);
    assert.equal(plan.unknownCompany, undefined);
    assert.deepEqual(plan.companyIds, scenario.ids);
    assert.equal(plan.intent, scenario.ids.length === 1 ? "company_recall" : "comparison");
    let documents = 0, generated = 0;
    const deps = fixtureDependencies(scenario.claims, {
      onEvidence: (evidence) => {
        const selected = new Set(evidence.map((item) => item.companyId));
        assert.deepEqual([...selected].sort(), [...scenario.ids].sort());
        for (const id of scenario.ids) assert.ok(evidence.some((item) => item.companyId === id && item.kind === "document"));
      },
    });
    const repository = deps.repository!;
    deps.repository = { ...repository, documents: async (ids) => { documents++; return repository.documents(ids); } };
    const generate = deps.generate!;
    deps.generate = async (...args) => { generated++; return generate(...args); };
    deps.embed = async () => { throw new Error("Named explanation must not embed"); };
    const result = await answerFromMemory(scenario.message, deps);
    assert.equal(result.status, "complete", result.answer);
    assert.equal(result.activeCompanyId, scenario.ids.length === 1 ? scenario.ids[0] : null);
    for (const claim of scenario.claims) assert.ok(result.answer.includes(claim.text));
    assert.deepEqual([...new Set(result.citations.map((citation) => citation.companyId))].sort(), [...scenario.ids].sort());
    for (const citation of result.citations) {
      const source = fixtureDocuments.find((document) => document.id === citation.documentId)!;
      assert.equal(source.rawText.slice(citation.location!.start, citation.location!.end), citation.quote);
    }
    assert.equal(documents, 1);
    assert.equal(generated, 1);
  });
}

for (const [message, unknown] of [
  ["Compare CodeFlow AI and Orchid Robotics.", "Orchid Robotics"],
  ["Compare Orchid Robotics and CodeFlow AI.", "Orchid Robotics"],
  ["What are the Key Risks for Orchid Robotics?", "Orchid Robotics"],
  ["Compare CodeFlow AI and Orchid Robotics and explain why we passed.", "Orchid Robotics"],
  ["Compare CodeFlow AI and why we passed and Orchid Robotics.", "Orchid Robotics"],
  ["Compare CodeFlow AI and explain the differences with Orchid Robotics.", "Orchid Robotics"],
  ["Compare CodeFlow AI, and tell me how it differs from Orchid Robotics.", "Orchid Robotics"],
  ["Compare CodeFlow AI and explain the differences with orchid robotics.", "orchid robotics"],
  ["Compare CodeFlow AI and Explain Robotics.", "Explain Robotics"],
  ['Compare CodeFlow AI and "explain robotics".', "explain robotics"],
  ['Compare CodeFlow AI and "tell robotics".', "tell robotics"],
  ['Compare CodeFlow AI and "Business Model".', "Business Model"],
  ["Compare CodeFlow AI and Why Labs.", "Why Labs"],
] as const) {
  test(`an explanation boundary never authorizes an unknown participant: ${message}`, async () => {
    const plan = planMemoryQuery({ message }, fixtureCompanies);
    assert.equal(plan.unknownCompany, unknown);
    const deps = fixtureDependencies([]);
    deps.repository!.documents = deps.repository!.list = async () => { throw new Error("Unknown entity must not retrieve evidence"); };
    deps.repository!.count = async () => { throw new Error("Unknown entity must not count"); };
    let providerCalls = 0;
    deps.embed = deps.generate = async () => { providerCalls++; throw new Error("Unknown entity must not call providers"); };
    const result = await answerFromMemory(message, deps);
    assert.equal(result.status, "insufficient_evidence", result.answer);
    assert.ok(result.answer.includes(unknown));
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.trace.evidenceIds, []);
    assert.equal(result.activeCompanyId, null);
    assert.equal(providerCalls, 0);
  });
}

for (const name of ["Explain Robotics", "Why Labs"]) {
  test(`catalog identity takes priority over a clause-like company name: ${name}`, async () => {
    const company: MemoryCompany = { ...fixtureCompanies[0], id: "verb-name", name };
    const rawText = `Company: ${name}\nRecorded concern: retention needs diligence.`;
    const document: MemoryDocument = { id: "verb-doc", companyId: company.id, companyName: name,
      filename: "verb-company.txt", docType: "notes", rawText, uploadedAt: "2026-11-25T00:00:00.000Z", chunks: [] };
    const message = `Compare CodeFlow AI and ${name} and explain the differences.`;
    const result = await answerFromMemory(message, fixtureDependencies([
      codeClaim,
      { companyId: company.id, text: `${name} has a recorded retention concern.`, quote: "Recorded concern: retention needs diligence." },
    ], { companies: [...fixtureCompanies, company], documents: [...fixtureDocuments, document] }));
    assert.equal(result.status, "complete", result.answer);
    assert.equal(result.trace.plan.unknownCompany, undefined);
    assert.deepEqual(result.trace.plan.companyIds, ["code", company.id]);
    assert.ok(result.answer.includes(`${name} has a recorded retention concern.`));
    assert.deepEqual(result.citations.map((citation) => citation.companyId), ["code", company.id]);
  });
}

test("explanatory turns retain request-scoped references without inheriting assistant facts", async () => {
  const message = "Who founded it?";
  const sourceQuestion = "Summarize FlowAI and explain our concerns.";
  const deps = fixtureDependencies([{ companyId: "flow", text: "Grace Lin is CEO.", quote: "Grace Lin, CEO." }]);
  const scoped = await answerFromMemory({ message, history: [
    { role: "user", content: sourceQuestion },
    { role: "assistant", content: "CodeFlow AI has imaginary founders." },
  ] }, deps);
  assert.equal(scoped.status, "complete");
  assert.equal(scoped.activeCompanyId, "flow");
  assert.match(scoped.answer, /Grace Lin/);
  assert.ok(scoped.citations.every((citation) => citation.companyId === "flow"));
  const fresh = await answerFromMemory({ message }, deps);
  assert.equal(fresh.status, "clarification");
  assert.deepEqual(fresh.citations, []);
});
