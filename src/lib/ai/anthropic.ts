import Anthropic from "@anthropic-ai/sdk";

/**
 * Central Anthropic client + model configuration.
 *
 * Model choices (see https://platform.claude.com/docs/en/about-claude/models):
 *   - REASONING: claude-opus-4-8  — deep extraction, analysis, brief writing.
 *   - FAST:      claude-haiku-4-5 — cheap/low-latency helpers (titles, tags).
 *
 * Opus 4.8 uses ADAPTIVE thinking only — `thinking: { type: "adaptive" }`.
 * Do NOT send `budget_tokens` / `temperature` / `top_p` (they 400 on 4.8).
 * Thinking depth is tuned via `output_config: { effort: ... }`.
 */
export const MODELS = {
  reasoning: process.env.ANTHROPIC_MODEL_REASONING ?? "claude-opus-4-8",
  fast: process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5",
} as const;

let client: Anthropic | null = null;

/** Lazily construct the client so the app can boot without a key set. */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Standard generation defaults shared across reasoning calls. */
export const REASONING_DEFAULTS = {
  model: MODELS.reasoning,
  max_tokens: 8000,
  thinking: { type: "adaptive" as const },
  output_config: { effort: "high" as const },
};
