import assert from "node:assert/strict";
import test from "node:test";
import {
  completeWithMetadata, llm, supportsStrictStructuredOutput,
  type CompletionProvider, type CompletionTransportOptions,
} from "../src/lib/ai/llm";

const answerSchema = {
  name: "memory_answer",
  schema: { type: "object", properties: { blocks: { type: "array", items: { type: "string" } } }, required: ["blocks"], additionalProperties: false },
};

function response(reasoningTokens?: number) {
  return {
    model: "returned-model",
    choices: [{ index: 0, finish_reason: "stop" as const, logprobs: null,
      message: { role: "assistant" as const, content: '{"blocks":[]}', reasoning: "private-reasoning-fixture" } }],
    usage: { prompt_tokens: 1400, completion_tokens: 588, total_tokens: 1988,
      ...(reasoningTokens !== undefined ? { completion_tokens_details: { reasoning_tokens: reasoningTokens } } : {}) },
  };
}

for (const model of ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]) {
  test(`runtime ${model} request has a bounded modern budget and supported reasoning/schema settings`, async () => {
    let sent: Parameters<CompletionProvider>[0] | undefined;
    let transport: CompletionTransportOptions | undefined;
    const result = await completeWithMetadata("Return a grounded JSON answer.", {
      model, maxTokens: 1800, maxCompletionTokens: 3200, reasoningEffort: "low",
      timeoutMs: 22_000, maxRetries: 0, responseSchema: answerSchema,
    }, async (request, options) => {
      sent = request;
      transport = options;
      return response(43);
    });
    assert.equal(sent?.max_tokens, undefined);
    assert.equal(sent?.max_completion_tokens, 3200);
    assert.equal(sent?.reasoning_effort, "low");
    assert.deepEqual(sent?.response_format, {
      type: "json_schema", json_schema: { ...answerSchema, strict: true },
    });
    assert.deepEqual(transport, { timeout: 22_000, maxRetries: 0 });
    assert.equal(result.configuredModel, model);
    assert.equal(result.returnedModel, "returned-model");
    assert.equal(result.finishReason, "stop");
    assert.equal(result.usage?.reasoningTokens, 43);
    assert.equal(result.usage?.completionTokens, 588);
    assert.ok(!JSON.stringify(result).includes("private-reasoning-fixture"));
  });
}

for (const model of ["llama-3.3-70b-versatile", "openai/gpt-oss-safeguard-20b", "custom-model"]) {
  test(`runtime ${model} override falls back to JSON without unsupported reasoning or strict schema`, async () => {
    let sent: Parameters<CompletionProvider>[0] | undefined;
    await completeWithMetadata("Return JSON.", {
      model, maxCompletionTokens: 3200, reasoningEffort: "low", responseSchema: answerSchema,
    }, async (request) => { sent = request; return response(); });
    assert.equal(supportsStrictStructuredOutput(model), false);
    assert.equal(sent?.reasoning_effort, undefined);
    assert.deepEqual(sent?.response_format, { type: "json_object" });
    assert.equal(sent?.max_completion_tokens, 3200);
    assert.equal(sent?.max_tokens, undefined);
  });
}

test("runtime default SDK provider receives per-attempt timeout and zero transport retries", async (context) => {
  const originalKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "fixture-key-no-network";
  try {
    const completions = llm().chat.completions;
    let transport: CompletionTransportOptions | undefined;
    let calls = 0;
    context.mock.method(completions, "create", (async (_request: unknown, options?: CompletionTransportOptions) => {
      calls++;
      transport = options;
      return response(0);
    }) as unknown as typeof completions.create);
    const result = await completeWithMetadata("Return JSON.", {
      model: "openai/gpt-oss-120b", maxCompletionTokens: 3200, timeoutMs: 1234, maxRetries: 0,
    });
    assert.equal(calls, 1);
    assert.deepEqual(transport, { timeout: 1234, maxRetries: 0 });
    assert.equal(result.usage?.reasoningTokens, 0);
  } finally {
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  }
});

test("invalid runtime bounds fail before calling a provider", async () => {
  let calls = 0;
  const provider: CompletionProvider = async () => { calls++; return response(); };
  for (const opts of [
    { timeoutMs: 0 }, { timeoutMs: -1 }, { timeoutMs: Infinity }, { timeoutMs: 60_001 },
    { maxRetries: -1 }, { maxRetries: 3 }, { maxRetries: 0.5 },
    { maxCompletionTokens: 0 }, { maxCompletionTokens: NaN }, { maxCompletionTokens: 5.5 },
  ]) {
    await assert.rejects(completeWithMetadata("Question", opts, provider), RangeError);
  }
  await assert.rejects(completeWithMetadata("Question", {
    responseSchema: { ...answerSchema, name: "invalid schema name" },
  }, provider), TypeError);
  assert.equal(calls, 0);
});

test("runtime rate limits preserve a safe classification without retrying", async () => {
  let calls = 0;
  await assert.rejects(completeWithMetadata("Question", { maxRetries: 0 }, async () => {
    calls++;
    throw Object.assign(new Error("private provider quota detail"), { status: 429 });
  }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /free-tier AI limit/);
    assert.ok(!error.message.includes("private provider quota detail"));
    assert.equal((error as Error & { status: number }).status, 429);
    return true;
  });
  assert.equal(calls, 1);
});
