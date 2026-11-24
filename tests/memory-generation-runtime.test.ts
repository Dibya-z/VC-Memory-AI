import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFromMemory } from "../src/lib/ai/chat";
import { memoryAnswerResponseSchema } from "../src/lib/ai/memory-generation";
import { buildMemoryPassages } from "../src/lib/ai/memory-passages";
import { companyRecordEvidence } from "../src/lib/ai/memory-evidence";
import type { CompleteOptions, CompletionResult } from "../src/lib/ai/llm";
import { fixtureCompanies, fixtureDependencies, fixtureDocuments, evidenceFromPrompt } from "./fixtures/memory";
import replay from "./fixtures/flowai-provider-replay.json";

const question = "Prep me for a meeting with FlowAI.";
const result = (text: string, finishReason: string | null = "stop"): CompletionResult => ({
  text, finishReason, configuredModel: "fixture-model", returnedModel: "fixture-model",
});
function supportedAnswer(prompt: string): string {
  const input = JSON.parse(prompt);
  const passage = input.passages.find((item: { text: string }) => item.text.includes("~$9k MRR"));
  assert.ok(passage, "The actual FlowAI traction passage must be available");
  return JSON.stringify({ blocks: [
    { kind: "fact", text: "FlowAI recorded approximately $9k MRR in October 2025.", supports: [{ passageId: passage.id }] },
    { kind: "unknown", text: "No current retention update is recorded here.", supports: [] },
    { kind: "suggestion", text: "Could you share an updated deck showing retention and reliability improvements?", supports: [] },
  ] });
}

test("meeting answers select canonical passages instead of copying or joining quotes", async () => {
  const deps = fixtureDependencies([]);
  deps.generate = async (prompt) => {
    const input = JSON.parse(prompt);
    assert.ok(input.evidence.every((source: { text?: string }) => source.text === undefined));
    assert.ok(input.passages.every((passage: { text?: string }) => typeof passage.text === "string"));
    const people = input.passages.find((passage: { text: string }) => passage.text.includes("Grace Lin"));
    assert.equal(people.companyName, "FlowAI");
    assert.equal(people.documentName, "flowai-notes.txt");
    assert.equal(people.sourceHeading, "FlowAI — Founder meeting notes");
    const reconstructed = evidenceFromPrompt(prompt);
    const doc = reconstructed.find((source) => source.documentId === "flow-doc")!;
    assert.equal(doc.text, fixtureDocuments.find((source) => source.id === "flow-doc")!.rawText);
    return result(supportedAnswer(prompt));
  };
  const answer = await answerFromMemory(question, deps);
  assert.equal(answer.status, "complete", answer.answer);
  assert.equal(answer.trace.plan.intent, "meeting_preparation");
  assert.equal(answer.trace.generation?.attempts.length, 1);
  assert.equal(answer.citations.length, 1);
  const citation = answer.citations[0];
  assert.match(citation.evidenceId!, /^P\d+$/);
  assert.equal(fixtureDocuments.find((source) => source.id === citation.documentId)!.rawText.slice(citation.location!.start, citation.location!.end), citation.quote);
});

for (const scenario of replay.cases) {
  test(`captured public-provider failure gets one bounded recovery: ${scenario.id}`, async () => {
    let calls = 0;
    let sameEvidence: unknown;
    const settings: (CompleteOptions | undefined)[] = [];
    const deps = fixtureDependencies([]);
    deps.generate = async (prompt, options) => {
      calls++; settings.push(options);
      const input = JSON.parse(prompt);
      if (calls === 1) {
        sameEvidence = { evidence: input.evidence, passages: input.passages };
        assert.equal(input.correction, undefined);
        return { ...result(scenario.text, scenario.finishReason), usage: scenario.usage };
      }
      assert.equal(calls, 2);
      assert.deepEqual({ evidence: input.evidence, passages: input.passages }, sameEvidence);
      assert.equal(input.correction.code, scenario.expectedFailure);
      assert.equal(input.previousAnswer, undefined);
      return result(supportedAnswer(prompt));
    };
    const answer = await answerFromMemory(question, deps);
    assert.equal(answer.status, "complete", answer.answer);
    assert.equal(calls, 2);
    assert.equal(settings[0]?.maxCompletionTokens, 3200);
    assert.equal(settings[1]?.maxCompletionTokens, 4000);
    for (const option of settings) {
      assert.equal(option?.reasoningEffort, "low");
      assert.equal(option?.maxRetries, 0);
      assert.ok(option!.timeoutMs! <= 22000);
      assert.equal(option?.responseSchema?.name, "memory_answer");
    }
    assert.equal(answer.trace.generation?.attempts[0].failure?.code, scenario.expectedFailure);
    assert.equal(answer.trace.generation?.failure, undefined);
    assert.equal(answer.trace.generation?.attempts.length, 2);
  });
}

for (const [text, code] of [
  ["not valid JSON", "json_parse"],
  ['{"blocks":[]}', "schema"],
  ['{"blocks":[{"kind":"fact","text":"FlowAI is Invested.","supports":[{"passageId":"P999999"}]}]}', "invalid_evidence_id"],
] as const) {
  test(`persistent ${code} fails closed after exactly two generations`, async () => {
    let calls = 0;
    const answer = await answerFromMemory(question, { ...fixtureDependencies([]), generate: async () => { calls++; return result(text); } });
    assert.equal(calls, 2);
    assert.equal(answer.status, "invalid_response");
    assert.equal(answer.trace.generation?.failure?.code, code);
    assert.deepEqual(answer.citations, []);
    assert.doesNotMatch(answer.answer, /Invested|P999999|blocks/);
  });
}

test("provider quota failures are classified without retrying or leaking provider details", async () => {
  let calls = 0;
  const secret = "private-provider-key-that-must-not-appear";
  const answer = await answerFromMemory(question, { ...fixtureDependencies([]), generate: async () => {
    calls++;
    throw Object.assign(new Error(secret), { status: 429 });
  } });
  assert.equal(calls, 1);
  assert.equal(answer.status, "provider_error");
  assert.equal(answer.trace.generation?.failure?.code, "provider_rate_limit");
  assert.ok(!JSON.stringify(answer).includes(secret));
});

test("a retry never starts after the overall request deadline", async () => {
  let now = 0, calls = 0;
  const answer = await answerFromMemory(question, { ...fixtureDependencies([]), now: () => now,
    generate: async () => { calls++; now = 50_001; return result('{"blocks":[', "length"); },
  });
  assert.equal(calls, 1);
  assert.equal(answer.status, "provider_error");
  assert.equal(answer.trace.generation?.failure?.code, "request_deadline");
});

test("content-filtered completions are withheld without trying to bypass the finish state", async () => {
  let calls = 0;
  const answer = await answerFromMemory(question, { ...fixtureDependencies([]), generate: async () => {
    calls++; return result("filtered", "content_filter");
  } });
  assert.equal(calls, 1);
  assert.equal(answer.status, "incomplete");
  assert.deepEqual(answer.citations, []);
});

test("strict response schema only permits supplied passage IDs and declares every object field", () => {
  const passage = { id: "P1", evidenceId: "one", text: "Recorded decision: Tracking", start: 0, end: 27 };
  const schema = memoryAnswerResponseSchema([passage]) as any;
  const block = schema.properties.blocks.items;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(block.required, ["kind", "text", "supports"]);
  assert.deepEqual(block.properties.supports.items.properties.passageId.enum, ["P1"]);
  assert.equal(block.properties.supports.items.additionalProperties, false);
  assert.deepEqual(buildMemoryPassages([]), []);
});

test("a missing extracted reason never becomes a claim that source documents lack reasons", () => {
  const company = fixtureCompanies.find((item) => item.id === "flow")!;
  const missing = companyRecordEvidence({ ...company, decisionReason: null });
  assert.doesNotMatch(missing.text, /Recorded decision reason:/);
  assert.match(missing.text, /Recorded decision: Tracking/);
  const recorded = companyRecordEvidence({ ...company, decisionReason: "Recorded pricing and retention concerns." });
  assert.match(recorded.text, /Recorded decision reason: Recorded pricing and retention concerns\./);
});
