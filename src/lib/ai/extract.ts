/**
 * Feature 1 — structured extraction.
 *
 * Given raw document text, call the LLM (Groq) and return validated structured
 * investment intelligence. `completeJSON` handles JSON Object mode + Zod
 * validation (or strict json_schema on gpt-oss models).
 *
 * TODO(impl):
 *   return completeJSON(
 *     `${EXTRACTION_SYSTEM}\n\nReturn JSON matching this schema:\n` +
 *       `${JSON.stringify(EXTRACTION_SCHEMA)}\n\nDocument:\n${documentText}`,
 *     extractedIntelligenceSchema,
 *     {
 *       system: EXTRACTION_SYSTEM,
 *       jsonSchema: EXTRACTION_SCHEMA, // used only on strict-capable models
 *       schemaName: "investment_intelligence",
 *     }
 *   );
 */

import type { ExtractedIntelligence } from "@/lib/types";

export async function extractIntelligence(
  _documentText: string
): Promise<ExtractedIntelligence> {
  throw new Error("extractIntelligence: not implemented yet");
}
