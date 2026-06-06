/**
 * Feature 3 — new deal analysis + memory comparison.
 *
 * Pipeline:
 *   1. Embed the new deck and retrieve the most similar PAST companies from
 *      memory (vector search, grouped by company).
 *   2. Pull those companies' decisions + reasoning ("what we concluded then").
 *   3. Ask the LLM to produce a grounded analysis — summary, positive signals,
 *      risks, founder questions, and a HEDGED recommendation — informed by the
 *      similar past deals.
 *
 * The AI never makes the final call; the recommendation stays hedged.
 */

import { z } from "zod";
import { completeJSON } from "@/lib/ai/llm";
import { ANALYSIS_SYSTEM } from "@/lib/ai/prompts";
import { embedOne } from "@/lib/embeddings";
import { vectorStore } from "@/lib/vector/local-store";
import { getCompaniesByIds } from "@/lib/db/queries";
import type { DealAnalysis, SimilarCompany } from "@/lib/types";

const MAX_SIMILAR = 4;
const SEARCH_TOPK = 16;

const analysisLlmSchema = z
  .object({
    summary: z.string().min(1),
    positiveSignals: z.unknown().optional(),
    risks: z.unknown().optional(),
    founderQuestions: z.unknown().optional(),
    recommendation: z.string().min(1),
  })
  .passthrough();

export async function analyzeNewDeal(documentText: string): Promise<DealAnalysis> {
  const similar = await findSimilarCompanies(documentText);

  const memoryContext = similar.length
    ? similar
        .map(
          (c) =>
            `- ${c.name}${c.sector ? ` (${c.sector})` : ""} — decision: ${
              c.decision ?? "none recorded"
            }${c.reason ? `. Reasoning: ${c.reason}` : ""}`
        )
        .join("\n")
    : "(no comparable past deals found in memory)";

  const prompt =
    `Return a single JSON object with this shape:\n` +
    `{ "summary": string, "positiveSignals": string[], "risks": string[], ` +
    `"founderQuestions": string[], "recommendation": string }\n\n` +
    `- summary: 2-3 sentences on what the company does and the headline read.\n` +
    `- positiveSignals: concrete strengths from the document.\n` +
    `- risks: concrete risks or concerns.\n` +
    `- founderQuestions: sharp diligence questions to ask the founders.\n` +
    `- recommendation: ONE hedged sentence — never a final invest/pass call.\n\n` +
    `Similar past deals from the firm's memory:\n${memoryContext}\n\n` +
    `New startup document:\n"""\n${documentText}\n"""`;

  const raw = await completeJSON(prompt, analysisLlmSchema, {
    system: ANALYSIS_SYSTEM,
    maxTokens: 1600,
    temperature: 0.3,
  });

  return {
    summary: raw.summary.trim(),
    positiveSignals: toStrArray(raw.positiveSignals),
    risks: toStrArray(raw.risks),
    founderQuestions: toStrArray(raw.founderQuestions),
    recommendation: raw.recommendation.trim(),
    similarCompanies: similar,
  };
}

async function findSimilarCompanies(
  documentText: string
): Promise<SimilarCompany[]> {
  const queryEmbedding = await embedOne(documentText.slice(0, 6000), "query");
  const chunks = await vectorStore.search(queryEmbedding, { topK: SEARCH_TOPK });

  // Best similarity score per company.
  const best = new Map<string, number>();
  for (const c of chunks) {
    if (!c.companyId) continue;
    const prev = best.get(c.companyId);
    if (prev === undefined || c.score > prev) best.set(c.companyId, c.score);
  }

  const topIds = [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SIMILAR)
    .map(([id]) => id);
  if (topIds.length === 0) return [];

  const companies = await getCompaniesByIds(topIds);
  const byId = new Map(companies.map((c) => [c.id, c]));

  const result: SimilarCompany[] = [];
  for (const id of topIds) {
    const c = byId.get(id);
    if (!c) continue;
    result.push({
      companyId: id,
      name: c.name,
      sector: c.sector ?? undefined,
      decision: c.decision ?? undefined,
      reason: c.decisionReason ?? undefined,
      similarity: Math.max(0, Math.round((best.get(id) ?? 0) * 100) / 100),
    });
  }
  return result;
}

function toStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((s) => s.length > 0);
}
