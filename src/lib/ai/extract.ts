/**
 * Feature 1 — structured extraction.
 *
 * Given raw document text, call Claude (Opus 4.8) with `output_config.format`
 * set to EXTRACTION_SCHEMA to get back validated structured investment
 * intelligence. Validate with `extractedIntelligenceSchema` before returning.
 *
 * TODO(impl):
 *   const msg = await anthropic().messages.create({
 *     model: MODELS.reasoning,
 *     max_tokens: 4000,
 *     thinking: { type: "adaptive" },
 *     system: EXTRACTION_SYSTEM,
 *     output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
 *     messages: [{ role: "user", content: documentText }],
 *   });
 *   parse first text block as JSON -> validate -> return ExtractedIntelligence
 */

import type { ExtractedIntelligence } from "@/lib/types";

export async function extractIntelligence(
  _documentText: string
): Promise<ExtractedIntelligence> {
  throw new Error("extractIntelligence: not implemented yet");
}
