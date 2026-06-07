import Groq from "groq-sdk";
import type { ZodType } from "zod";

/**
 * Central LLM client + model configuration.
 *
 * Provider: Groq (https://console.groq.com) — OpenAI-compatible inference with a
 * genuinely free tier (no credit card). Chosen so the whole prototype runs at
 * $0: Groq for reasoning + Voyage's free tier for embeddings.
 *
 * Models (https://console.groq.com/docs/models):
 *   - REASONING: llama-3.3-70b-versatile — extraction, analysis, brief writing.
 *   - FAST:      llama-3.1-8b-instant    — cheap/low-latency helpers.
 *
 * Free-tier limits (per model, subject to change): ~30 req/min, ~1,000 req/day,
 * which is plenty for a case-study demo. Override any model via the
 * GROQ_MODEL_* env vars.
 *
 * Unlike Anthropic Opus 4.8, Groq/Llama models accept standard sampling params
 * (`temperature`) and have no `thinking`/`effort` knobs — the request surface is
 * the OpenAI-style `chat.completions.create`.
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
  maxTokens?: number;
  temperature?: number;
}

/**
 * Translate provider errors into clean, user-facing messages. The Groq free tier
 * enforces a daily token cap; without this a reviewer would see a raw 429 JSON
 * blob. Rate-limit errors are not retried (retrying won't help).
 */
function asFriendlyError(e: unknown): Error {
  const status = (e as { status?: number } | null)?.status;
  const msg = e instanceof Error ? e.message : String(e);
  if (status === 429 || /rate.?limit|tokens per day|\bTPD\b|quota/i.test(msg)) {
    return new Error(
      "The demo has hit its free-tier AI limit for now. Please try again in a few minutes."
    );
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
  let res;
  try {
    res = await llm().chat.completions.create({
      model: opts.model ?? MODELS.reasoning,
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.4,
      messages: [
        ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
        { role: "user" as const, content: userContent },
      ],
    });
  } catch (e) {
    throw asFriendlyError(e);
  }
  return res.choices[0]?.message?.content ?? "";
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
 * Upgrade path: set GROQ_MODEL_REASONING to an `openai/gpt-oss-*` model (also
 * free on Groq). Those support constrained decoding, so we switch to strict
 * `json_schema` mode automatically for guaranteed schema adherence — no caller
 * changes. Pass `jsonSchema` to enable this.
 */
export async function completeJSON<T>(
  userContent: string,
  schema: ZodType<T>,
  opts: CompleteJSONOptions = {}
): Promise<T> {
  const model = opts.model ?? MODELS.reasoning;
  const strictCapable = model.startsWith("openai/gpt-oss");

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
