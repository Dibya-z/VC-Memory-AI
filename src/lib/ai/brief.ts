/**
 * Feature 4 — partner-ready investment brief for a company already in memory.
 *
 * Pipeline:
 *   1. Load the company's accumulated intelligence from memory (getCompany).
 *   2. Find the most similar PAST deals (vector search, excluding the company
 *      itself) so the brief can reference what the firm concluded before.
 *   3. Ask the LLM to synthesize a structured, partner-ready memo — grounded
 *      ONLY in the firm's recorded facts, ending with a HEDGED recommendation.
 *
 * The AI never makes the final call; the recommendation stays hedged.
 */

import { z } from "zod";
import { completeJSON } from "@/lib/ai/llm";
import { BRIEF_SYSTEM } from "@/lib/ai/prompts";
import { embedOne } from "@/lib/embeddings";
import { vectorStore } from "@/lib/vector/local-store";
import { getCompany, getCompaniesByIds } from "@/lib/db/queries";
import type {
  CompanyDetail,
  InvestmentBrief,
  SimilarCompany,
} from "@/lib/types";

const MAX_SIMILAR = 3;
const SEARCH_TOPK = 16;

const briefLlmSchema = z
  .object({
    overview: z.string().min(1),
    problem: z.string().optional(),
    solution: z.string().optional(),
    market: z.string().optional(),
    founderSignals: z.string().optional(),
    traction: z.string().optional(),
    strengths: z.unknown().optional(),
    risks: z.unknown().optional(),
    questionsForFounder: z.unknown().optional(),
    recommendation: z.string().min(1),
  })
  .passthrough();

export async function generateBrief(companyId: string): Promise<InvestmentBrief> {
  const company = await getCompany(companyId);
  if (!company) throw new Error("Company not found in memory.");

  const similar = await findSimilarPastDeals(company);

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
    `Write an investment brief as a single JSON object with this shape:\n` +
    `{ "overview": string, "problem": string, "solution": string, ` +
    `"market": string, "founderSignals": string, "traction": string, ` +
    `"strengths": string[], "risks": string[], ` +
    `"questionsForFounder": string[], "recommendation": string }\n\n` +
    `- overview: 2-3 sentences — what the company does and the headline read.\n` +
    `- problem / solution / market / traction: a few sentences each, grounded in ` +
    `the memory below. Use "Not captured in memory." if a section is unknown.\n` +
    `- founderSignals: what the firm knows about the team and why it matters.\n` +
    `- strengths / risks: the sharpest 3-5 of each.\n` +
    `- questionsForFounder: 3-5 sharp diligence questions.\n` +
    `- recommendation: ONE hedged sentence — never a final invest/pass call.\n\n` +
    `Comparable past deals from the firm's memory:\n${memoryContext}\n\n` +
    `The firm's recorded memory of ${company.name}:\n"""\n${buildProfile(company)}\n"""`;

  const raw = await completeJSON(prompt, briefLlmSchema, {
    system: BRIEF_SYSTEM,
    maxTokens: 2200,
    temperature: 0.3,
  });

  return {
    company: company.name,
    overview: raw.overview.trim(),
    problem: toStr(raw.problem),
    solution: toStr(raw.solution),
    market: toStr(raw.market),
    founderSignals: toStr(raw.founderSignals),
    traction: toStr(raw.traction),
    strengths: toStrArray(raw.strengths),
    risks: toStrArray(raw.risks),
    similarPastDeals: similar,
    questionsForFounder: toStrArray(raw.questionsForFounder),
    recommendation: raw.recommendation.trim(),
  };
}

/** Vector-search for the closest OTHER companies, grouped + ranked by company. */
async function findSimilarPastDeals(
  company: CompanyDetail
): Promise<SimilarCompany[]> {
  const queryEmbedding = await embedOne(buildProfile(company).slice(0, 6000), "query");
  const chunks = await vectorStore.search(queryEmbedding, {
    topK: SEARCH_TOPK,
    excludeCompanyId: company.id,
  });

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

/** Flatten a company's accumulated memory into a text profile for the LLM. */
function buildProfile(c: CompanyDetail): string {
  const lines: string[] = [`Company: ${c.name}`];
  if (c.sector) lines.push(`Sector: ${c.sector}`);
  if (c.stage) lines.push(`Stage: ${c.stage}`);
  if (c.oneLiner) lines.push(`One-liner: ${c.oneLiner}`);
  if (c.problem) lines.push(`Problem: ${c.problem}`);
  if (c.solution) lines.push(`Solution: ${c.solution}`);
  if (c.market) lines.push(`Market: ${c.market}`);
  if (c.businessModel) lines.push(`Business model: ${c.businessModel}`);
  if (c.traction) lines.push(`Traction: ${c.traction}`);
  if (c.competition) lines.push(`Competition: ${c.competition}`);
  if (c.founders.length) {
    lines.push(
      `Founders: ${c.founders
        .map(
          (f) =>
            `${f.name}${f.role ? ` (${f.role})` : ""}${
              f.background ? ` — ${f.background}` : ""
            }`
        )
        .join("; ")}`
    );
  }
  if (c.strengths.length) lines.push(`Strengths: ${c.strengths.join("; ")}`);
  if (c.risks.length) lines.push(`Risks: ${c.risks.join("; ")}`);
  if (c.concerns.length) lines.push(`Concerns: ${c.concerns.join("; ")}`);
  if (c.decision) {
    lines.push(
      `Prior decision: ${c.decision}${
        c.decisionReason ? ` — ${c.decisionReason}` : ""
      }`
    );
  }
  return lines.join("\n");
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((s) => s.length > 0);
}
