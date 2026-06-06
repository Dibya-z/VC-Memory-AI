/**
 * Feature 1 — structured extraction.
 *
 * Given raw document text, call the LLM (Groq) and return validated structured
 * investment intelligence. We ask the model for a single JSON object; the only
 * hard requirement is a non-empty `company` (so `completeJSON` rarely needs its
 * corrective retry). Everything else is coerced defensively in `normalize()` —
 * models are inconsistent about enums, nulls, and array-vs-string — and the
 * result is finally checked against the strict `extractedIntelligenceSchema`
 * before it can reach the database.
 */

import { z } from "zod";
import { completeJSON } from "@/lib/ai/llm";
import { EXTRACTION_SCHEMA, EXTRACTION_SYSTEM } from "@/lib/ai/prompts";
import { extractedIntelligenceSchema } from "@/lib/validators";
import { DECISIONS, DOC_TYPES } from "@/config/constants";
import type { Decision, DocType } from "@/config/constants";
import type { ExtractedIntelligence, Founder } from "@/lib/types";

/** Permissive shape for the raw model output — only `company` is enforced. */
const llmOutputSchema = z
  .object({
    company: z.string().min(1),
    sector: z.unknown().optional(),
    stage: z.unknown().optional(),
    oneLiner: z.unknown().optional(),
    problem: z.unknown().optional(),
    solution: z.unknown().optional(),
    businessModel: z.unknown().optional(),
    market: z.unknown().optional(),
    traction: z.unknown().optional(),
    competition: z.unknown().optional(),
    founders: z.unknown().optional(),
    strengths: z.unknown().optional(),
    risks: z.unknown().optional(),
    concerns: z.unknown().optional(),
    decision: z.unknown().optional(),
    decisionReason: z.unknown().optional(),
    docType: z.unknown().optional(),
  })
  .passthrough();

export async function extractIntelligence(
  documentText: string
): Promise<ExtractedIntelligence> {
  const prompt =
    `Extract structured venture-capital intelligence from the document below ` +
    `and return it as a single JSON object matching this schema:\n\n` +
    `${JSON.stringify(EXTRACTION_SCHEMA)}\n\n` +
    `Rules:\n` +
    `- Use only what the document supports; omit a field rather than inventing it.\n` +
    `- "decision" must be one of ${DECISIONS.join(", ")} (or null if the document records no firm decision).\n` +
    `- "docType" must be one of ${DOC_TYPES.join(", ")}.\n` +
    `- "founders" is an array of { name, role, background }.\n` +
    `- "strengths", "risks", "concerns" are arrays of short strings.\n\n` +
    `Document:\n"""\n${documentText}\n"""`;

  const raw = await completeJSON(prompt, llmOutputSchema, {
    system: EXTRACTION_SYSTEM,
    jsonSchema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "investment_intelligence",
    maxTokens: 2000,
    temperature: 0.1,
  });

  const normalized = normalize(raw);
  // Final strict guard — should always pass once normalized.
  return extractedIntelligenceSchema.parse(normalized) as ExtractedIntelligence;
}

// ── coercion helpers ─────────────────────────────────────────────────────────

function toStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function toStrArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

function toFounders(v: unknown): Founder[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: Founder[] = [];
  for (const f of v) {
    if (typeof f === "string") {
      const name = f.trim();
      if (name) out.push({ name });
    } else if (f && typeof f === "object") {
      const rec = f as Record<string, unknown>;
      const name = toStr(rec.name);
      if (name) {
        out.push({ name, role: toStr(rec.role), background: toStr(rec.background) });
      }
    }
  }
  return out.length ? out : undefined;
}

function toDecision(v: unknown): Decision | null {
  const s = toStr(v);
  if (!s) return null;
  return DECISIONS.find((d) => d.toLowerCase() === s.toLowerCase()) ?? null;
}

function toDocType(v: unknown): DocType | undefined {
  const s = toStr(v)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return undefined;
  return DOC_TYPES.find((d) => d === s) ?? "other";
}

function normalize(raw: z.infer<typeof llmOutputSchema>): ExtractedIntelligence {
  return {
    company: raw.company.trim(),
    sector: toStr(raw.sector),
    stage: toStr(raw.stage),
    oneLiner: toStr(raw.oneLiner),
    problem: toStr(raw.problem),
    solution: toStr(raw.solution),
    businessModel: toStr(raw.businessModel),
    market: toStr(raw.market),
    traction: toStr(raw.traction),
    competition: toStr(raw.competition),
    founders: toFounders(raw.founders),
    strengths: toStrArray(raw.strengths),
    risks: toStrArray(raw.risks),
    concerns: toStrArray(raw.concerns),
    decision: toDecision(raw.decision),
    decisionReason: toStr(raw.decisionReason) ?? null,
    docType: toDocType(raw.docType),
  };
}
