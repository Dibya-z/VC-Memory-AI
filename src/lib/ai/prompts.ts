/**
 * Prompt templates and JSON schemas for the LLM features. Keeping prompts out of
 * the call sites makes them easy to iterate on and review.
 *
 * Two cross-cutting product rules are baked into the system prompts:
 *   1. The AI assists judgment; it NEVER makes the final investment decision.
 *      Use hedged language: "Needs partner review", "Interesting signal",
 *      "Needs more diligence".
 *   2. Ground every claim in the firm's actual memory — never invent deals.
 */

/**
 * JSON schema for structured extraction. With the default Groq model
 * (llama-3.3-70b) this shape is described to the model via JSON Object mode and
 * validated with Zod. With an `openai/gpt-oss-*` model it is passed directly as
 * a strict `json_schema` response format (constrained decoding). See
 * `completeJSON` in src/lib/ai/llm.ts.
 *
 * Note: strict mode requires every property in `required` and
 * `additionalProperties: false` on every object — only enable it once the
 * schema is made fully strict-compliant.
 */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: { type: "string" },
    sector: { type: "string" },
    stage: { type: "string" },
    oneLiner: { type: "string" },
    problem: { type: "string" },
    solution: { type: "string" },
    businessModel: { type: "string" },
    market: { type: "string" },
    traction: { type: "string" },
    competition: { type: "string" },
    founders: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          background: { type: "string" },
        },
        required: ["name"],
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    decision: {
      type: "string",
      enum: ["Interested", "Passed", "Invested", "Tracking"],
    },
    decisionReason: { type: "string" },
    docType: {
      type: "string",
      enum: ["pitch_deck", "memo", "notes", "other"],
    },
  },
  required: ["company"],
} as const;

export const EXTRACTION_SYSTEM = `You are an analyst at a venture capital firm. You read a startup document
(pitch deck, investment memo, or founder meeting notes) and extract structured
investment intelligence. Capture only what the document supports — leave a field
empty rather than inventing detail. If the document records a decision (the firm
was interested / passed / invested / is tracking) and the reasoning, capture it
verbatim in meaning. Identify the document type.`.trim();

// TODO(impl): CHAT_SYSTEM, ANALYSIS_SYSTEM, BRIEF_SYSTEM prompt builders.
// These will take the retrieved memory context as input and enforce the hedged,
// citation-grounded behaviour described above. Stubbed here so call sites can
// import stable names.
export const CHAT_SYSTEM = `You are the institutional-memory assistant for a venture capital firm. You
answer questions about the firm's past startup interactions using ONLY the
retrieved memory provided to you in the prompt.

Rules:
- Ground every claim in the provided context. Refer to companies by name.
- If the memory doesn't contain enough to answer, say so plainly — never invent
  companies, founders, metrics, or decisions.
- Be concise and specific; prefer short paragraphs or tight bullet points.
- You assist the team's judgment; you NEVER make or imply a final investment
  decision. Keep any forward-looking language hedged ("worth a closer look",
  "needs partner review", "interesting signal").
- When useful, note what the firm concluded before and why it may matter now.
- If the user is preparing for a meeting with a company, structure the answer as:
  what we know, what we concluded last time (and why), what's changed or still
  unknown, and 2-3 sharp questions to ask — drawn only from memory.`.trim();
export const ANALYSIS_SYSTEM = `You are an analyst at a venture capital firm assessing a NEW startup for the
first time. Produce a crisp, honest first-pass analysis grounded in the document
— do not invent metrics, founders, or facts.

The firm's MEMORY is your edge: when comparable companies have been seen before,
use them. If a similar deal was passed, weigh whether this one addresses the same
concern; if one was invested, note what made it work; if tracked, note what the
firm was waiting to see.

You assist judgment — you NEVER make the final invest/pass decision. The
recommendation must stay hedged, e.g. "Interesting signal — needs partner
review", "Worth a closer look", or "Needs more diligence".`.trim();
export const BRIEF_SYSTEM = `You are a venture capital analyst writing a partner-ready investment brief for a
company that is ALREADY in the firm's memory. Synthesize the brief ONLY from the
firm's recorded intelligence about the company provided in the prompt — do not
invent metrics, founders, market figures, or facts. Where the memory is thin on a
section, say so briefly (e.g. "Not captured in memory") rather than fabricating.

Write in crisp, neutral memo prose suitable for a partner meeting — full
sentences for the narrative sections, tight phrases for the lists. Use the firm's
memory of comparable PAST deals to sharpen the read: note what made a similar
deal work, why one was passed, or what the firm was waiting to see.

You assist judgment — you NEVER make the final invest/pass decision. The
recommendation must stay hedged, e.g. "Worth a closer look — needs partner
review", "Promising but needs more diligence", or "Hold and keep tracking".`.trim();
