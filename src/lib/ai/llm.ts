import Groq from "groq-sdk";
import type { ZodType } from "zod";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";

/**
 * Central LLM client + model configuration.
 *
 * Groq provides generation and Voyage provides embeddings. Keep configured
 * model overrides; provider availability and quotas depend on the account.
 */
export const MODELS = {
  reasoning: process.env.GROQ_MODEL_REASONING ?? "llama-3.3-70b-versatile",
  fast: process.env.GROQ_MODEL_FAST ?? "llama-3.1-8b-instant",
} as const;

let client: Groq | null = null;

/** Lazily construct the client so the app can boot without a key set. */
export function llm(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Copy .env.example to .env and add your key " +
        "(free, no credit card, at https://console.groq.com/keys)."
    );
  }
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

export interface CompleteOptions {
  system?: string;
  model?: string;
  /** Legacy callers retain max_tokens; new chat callers use maxCompletionTokens. */
  maxTokens?: number;
  maxCompletionTokens?: number;
  temperature?: number;
  /** Request JSON object mode; callers still validate the resulting object. */
  json?: boolean;
  /** Sent only to the supported GPT-OSS reasoning models. */
  reasoningEffort?: "low" | "medium" | "high";
  /** Optional per-attempt transport bounds; omitted options retain SDK defaults. */
  timeoutMs?: number;
  maxRetries?: number;
  /** Strict schema for supported models; other models use validated JSON mode. */
  responseSchema?: { name: string; schema: Record<string, unknown> };
}

export interface CompletionResult {
  text: string;
  configuredModel: string;
  returnedModel: string | null;
  finishReason: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
  };
}

type CompletionResponse = Pick<Groq.Chat.ChatCompletion, "choices" | "model" | "usage">;
type CompletionRequest = ChatCompletionCreateParamsNonStreaming;
export interface CompletionTransportOptions {
  timeout?: number;
  maxRetries?: number;
}
export type CompletionProvider = (
  request: CompletionRequest,
  options?: CompletionTransportOptions,
) => Promise<CompletionResponse>;

/** Keep capability assumptions explicit; an arbitrary model override is not GPT-OSS. */
export function supportsStrictStructuredOutput(model: string): boolean {
  return model === "openai/gpt-oss-120b" || model === "openai/gpt-oss-20b";
}

function completionTransportOptions(opts: CompleteOptions): CompletionTransportOptions | undefined {
  if (opts.timeoutMs !== undefined && (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0 || opts.timeoutMs > 60_000)) {
    throw new RangeError("Completion timeout must be greater than zero and at most 60000 milliseconds.");
  }
  if (opts.maxRetries !== undefined && (!Number.isInteger(opts.maxRetries) || opts.maxRetries < 0 || opts.maxRetries > 2)) {
    throw new RangeError("Completion transport retries must be an integer from zero to two.");
  }
  return opts.timeoutMs === undefined && opts.maxRetries === undefined ? undefined : {
    ...(opts.timeoutMs !== undefined ? { timeout: opts.timeoutMs } : {}),
    ...(opts.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
  };
}

/**
 * Translate provider errors into clean, user-facing messages. The Groq free tier
 * enforces a daily token cap; without this a reviewer would see a raw 429 JSON
 * blob. These errors do not trigger JSON-shape retries; the SDK's transport
 * retry policy still applies.
 */
function asFriendlyError(e: unknown): Error {
  const status = (e as { status?: number } | null)?.status;
  const msg = e instanceof Error ? e.message : String(e);
  if (status === 429 || /rate.?limit|tokens per day|\bTPD\b|quota/i.test(msg)) {
    return Object.assign(new Error(
      "The demo has hit its free-tier AI limit for now. Please try again in a few minutes."
    ), { status: 429, code: "rate_limit" });
  }
  return e instanceof Error ? e : new Error(msg);
}

/**
 * Plain-text completion — used for chat answers and brief prose.
 */
export async function complete(
  userContent: string,
  opts: CompleteOptions = {}
): Promise<string> {
  return (await completeWithMetadata(userContent, opts)).text;
}

/** Preserve completion state so Memory Chat can reject unfinished answers. */
export async function completeWithMetadata(
  userContent: string,
  opts: CompleteOptions = {},
  provider: CompletionProvider = (request, transport) => llm().chat.completions.create(request, transport)
): Promise<CompletionResult> {
  const configuredModel = opts.model ?? MODELS.reasoning;
  const transport = completionTransportOptions(opts);
  if (opts.maxCompletionTokens !== undefined && (!Number.isInteger(opts.maxCompletionTokens) || opts.maxCompletionTokens < 1)) {
    throw new RangeError("Completion token budget must be a positive integer.");
  }
  if (opts.responseSchema && !/^[A-Za-z0-9_-]{1,64}$/.test(opts.responseSchema.name)) {
    throw new TypeError("Completion schema name must use 1–64 letters, numbers, underscores, or hyphens.");
  }
  const supported = supportsStrictStructuredOutput(configuredModel);
  const responseFormat = opts.responseSchema && supported ? {
    type: "json_schema" as const,
    json_schema: { name: opts.responseSchema.name, schema: opts.responseSchema.schema, strict: true },
  } : opts.json || opts.responseSchema ? { type: "json_object" as const } : undefined;
  let res;
  try {
    res = await provider({
      model: configuredModel,
      ...(opts.maxCompletionTokens !== undefined
        ? { max_completion_tokens: opts.maxCompletionTokens }
        : { max_tokens: opts.maxTokens ?? 4000 }),
      temperature: opts.temperature ?? 0.4,
      ...(supported && opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
      messages: [
        ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
        { role: "user" as const, content: userContent },
      ],
    }, transport);
  } catch (e) {
    throw asFriendlyError(e);
  }
  return {
    text: res.choices[0]?.message?.content ?? "",
    configuredModel,
    returnedModel: res.model ?? null,
    finishReason: res.choices[0]?.finish_reason ?? null,
    ...(res.usage ? { usage: {
      promptTokens: res.usage.prompt_tokens,
      completionTokens: res.usage.completion_tokens,
      totalTokens: res.usage.total_tokens,
      ...(res.usage.completion_tokens_details?.reasoning_tokens !== undefined ? {
        reasoningTokens: res.usage.completion_tokens_details.reasoning_tokens,
      } : {}),
    } } : {}),
  };
}

export interface CompleteJSONOptions extends CompleteOptions {
  /** JSON Schema object — only used when the model supports strict mode. */
  jsonSchema?: Record<string, unknown>;
  /** Name for the strict json_schema response format. */
  schemaName?: string;
}

/**
 * Structured JSON completion — returns a value validated against `schema` (Zod).
 *
 * Default path (llama-3.3-70b and friends): Groq **JSON Object mode**, which
 * guarantees syntactically valid JSON. The desired *shape* is described to the
 * model in the prompt and enforced on our side with Zod + one corrective retry.
 *
 * Strict schema mode remains disabled until all extraction schemas satisfy the
 * provider's strict requirements. Environment model overrides still apply.
 */
export async function completeJSON<T>(
  userContent: string,
  schema: ZodType<T>,
  opts: CompleteJSONOptions = {}
): Promise<T> {
  const model = opts.model ?? MODELS.reasoning;
  const strictCapable = false; // model.startsWith("openai/gpt-oss");

  const responseFormat =
    strictCapable && opts.jsonSchema
      ? {
          type: "json_schema" as const,
          json_schema: {
            name: opts.schemaName ?? "result",
            strict: true,
            schema: opts.jsonSchema,
          },
        }
      : { type: "json_object" as const };

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
    { role: "user" as const, content: userContent },
  ];

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await llm().chat.completions.create({
        model,
        max_tokens: opts.maxTokens ?? 4000,
        temperature: opts.temperature ?? 0.2,
        response_format: responseFormat,
        messages,
      });
    } catch (e) {
      // Don't retry provider errors (e.g. 429 rate limit) as JSON-shape retries.
      throw asFriendlyError(e);
    }
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      return schema.parse(JSON.parse(raw));
    } catch (e) {
      lastErr = e;
      // Nudge the model with the validation error and try once more.
      messages.push(
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            `That response did not match the required JSON shape (${String(e)}). ` +
            `Reply with ONLY the corrected JSON object — no prose, no code fences.`,
        }
      );
    }
  }
  throw new Error(`completeJSON: invalid JSON after retry — ${String(lastErr)}`);
}
