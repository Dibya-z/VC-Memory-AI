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
export const CHAT_SYSTEM = "TODO: memory chatbot system prompt";
export const ANALYSIS_SYSTEM = "TODO: new-deal analysis system prompt";
export const BRIEF_SYSTEM = "TODO: investment brief system prompt";
