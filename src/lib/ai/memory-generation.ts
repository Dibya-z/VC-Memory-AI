import { completeWithMetadata, MODELS, type CompletionResult } from "./llm";
import { CHAT_SYSTEM, buildMemoryChatPrompt } from "./prompts";
import { buildMemoryPassages, type MemoryPassage } from "./memory-passages";
import { MemoryAnswerValidationError, validateMemoryAnswer } from "./memory-citations";
import type { MemoryEvidence, QueryPlan } from "./memory-contract";
import type { Citation } from "@/lib/types";

const REQUEST_BUDGET_MS = 50_000;
const ATTEMPT_BUDGET_MS = 22_000;
const MIN_ATTEMPT_MS = 1_000;
const MAX_ATTEMPTS = 2;

export interface MemoryGenerationFailure {
  code: string;
  path?: (string | number)[];
}

export interface MemoryGenerationAttempt {
  attempt: number;
  configuredModel: string;
  returnedModel: string | null;
  finishReason: string | null;
  maxCompletionTokens: number;
  usage?: CompletionResult["usage"];
  failure?: MemoryGenerationFailure;
}

export interface MemoryGenerationTrace {
  configuredModel: string;
  returnedModel: string | null;
  finishReason: string | null;
  usage?: CompletionResult["usage"];
  attempts: MemoryGenerationAttempt[];
  failure?: MemoryGenerationFailure;
}

export interface MemoryGenerationResult {
  answer: string;
  citations: Citation[];
  status: "complete" | "incomplete" | "invalid_response" | "provider_error";
  generation: MemoryGenerationTrace;
  passageIds: string[];
}

/** A structural guarantee is separate from source support, which stays server-validated. */
export function memoryAnswerResponseSchema(passages: MemoryPassage[]): Record<string, unknown> {
  return {
    type: "object", additionalProperties: false, required: ["blocks"],
    properties: { blocks: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["kind", "text", "supports"],
      properties: {
        kind: { type: "string", enum: ["fact", "interpretation", "suggestion", "unknown"] },
        text: { type: "string" },
        supports: { type: "array", items: {
          type: "object", additionalProperties: false, required: ["passageId"],
          properties: { passageId: { type: "string", enum: passages.map((passage) => passage.id) } },
        } },
      },
    } } },
  };
}

function validationFailure(error: unknown): MemoryGenerationFailure {
  if (error instanceof SyntaxError) return { code: "json_parse" };
  if (error instanceof MemoryAnswerValidationError) {
    const allowed = new Set(["blocks", "kind", "text", "supports", "passageId", "evidenceId", "quote"]);
    const path = error.path?.filter((part) => typeof part === "number" || allowed.has(part)).slice(0, 8);
    return { code: error.code, ...(path?.length ? { path } : {}) };
  }
  return { code: "schema" };
}

function providerFailure(error: unknown): MemoryGenerationFailure {
  const info = error as { status?: number; name?: string; code?: string } | null;
  if (info?.status === 429 || info?.code === "rate_limit") return { code: "provider_rate_limit" };
  if (info?.name === "TimeoutError" || info?.name === "APIConnectionTimeoutError") return { code: "provider_timeout" };
  return { code: "provider_error" };
}

async function withinDeadline<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("Generation deadline exceeded"), { name: "TimeoutError" })), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** At most two bounded generations against the same authoritative evidence. */
export async function generateGroundedMemoryAnswer(
  plan: QueryPlan,
  evidence: MemoryEvidence[],
  coverage: string,
  dependencies: { generate: typeof completeWithMetadata; now: () => number; startedAt: number },
): Promise<MemoryGenerationResult> {
  const passages = buildMemoryPassages(evidence);
  const generation: MemoryGenerationTrace = {
    configuredModel: MODELS.reasoning, returnedModel: null, finishReason: null, attempts: [],
  };
  let failure: MemoryGenerationFailure | undefined;
  let status: MemoryGenerationResult["status"] = "invalid_response";
  const finish = (answer: string, nextStatus = status, citations: Citation[] = []): MemoryGenerationResult => ({
    answer, status: nextStatus, citations, passageIds: passages.map((passage) => passage.id),
    generation: { ...generation, ...(failure ? { failure } : {}) },
  });
  if (!passages.length) {
    failure = { code: "no_passages" };
    return finish("I couldn't find usable source passages for this answer.");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = REQUEST_BUDGET_MS - (dependencies.now() - dependencies.startedAt);
    if (remaining < MIN_ATTEMPT_MS) {
      failure = { code: "request_deadline" };
      return finish("The answer took too long to complete. Please try again.", "provider_error");
    }
    const maxCompletionTokens = attempt === 1 ? (plan.intent === "meeting_preparation" ? 3200 : 2200) : 4000;
    const timeoutMs = Math.min(ATTEMPT_BUDGET_MS, remaining);
    const record: MemoryGenerationAttempt = {
      attempt, configuredModel: MODELS.reasoning, returnedModel: null, finishReason: null, maxCompletionTokens,
    };
    generation.attempts.push(record);
    let completion: CompletionResult;
    try {
      completion = await withinDeadline(dependencies.generate(
        buildMemoryChatPrompt(plan, evidence, coverage, { passages, ...(failure ? { correction: failure } : {}) }), {
          system: CHAT_SYSTEM, model: MODELS.reasoning, maxCompletionTokens, reasoningEffort: "low",
          temperature: 0, json: true, responseSchema: { name: "memory_answer", schema: memoryAnswerResponseSchema(passages) },
          timeoutMs, maxRetries: 0,
        },
      ), timeoutMs);
    } catch (error) {
      failure = providerFailure(error);
      record.failure = failure;
      return finish("The answer provider is temporarily unavailable. Please try again.", "provider_error");
    }
    Object.assign(record, {
      configuredModel: completion.configuredModel, returnedModel: completion.returnedModel,
      finishReason: completion.finishReason, ...(completion.usage ? { usage: completion.usage } : {}),
    });
    Object.assign(generation, {
      configuredModel: completion.configuredModel, returnedModel: completion.returnedModel,
      finishReason: completion.finishReason, usage: completion.usage,
    });
    if (completion.finishReason !== "stop" || !completion.text.trim()) {
      failure = { code: completion.finishReason === "length" ? "completion_length" : !completion.text.trim() ? "empty_completion" : "completion_finish" };
      record.failure = failure;
      status = "incomplete";
      if (completion.finishReason !== "length" && !(completion.finishReason === "stop" && !completion.text.trim())) break;
      continue;
    }
    try {
      const validated = validateMemoryAnswer(JSON.parse(completion.text), evidence, passages);
      failure = undefined;
      return finish(validated.answer, "complete", validated.citations);
    } catch (error) {
      failure = validationFailure(error);
      record.failure = failure;
      status = "invalid_response";
      if (failure.code === "instruction_source") break;
    }
  }
  return finish(status === "incomplete"
    ? "I couldn't finish this answer. Please try again."
    : "I couldn't verify the answer's source references. Please try again.");
}
