import type { DealAnalysis, SimilarCompany } from "@/lib/types";

export const ANALYSIS_SESSION_KEY = "vc-memory-analysis-session-v1";
export const ANALYSIS_SESSION_LIMIT = 250_000;

export interface AnalysisSession {
  version: 1;
  mode: "file" | "text";
  text: string;
  filename: string;
  analyzedName: string;
  analysis: DealAnalysis | null;
}

function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((entry) => typeof entry === "string" && entry.length <= 30_000)
  );
}

function comparable(value: unknown): value is SimilarCompany {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.companyId === "string" &&
    typeof item.name === "string" &&
    typeof item.similarity === "number" &&
    Number.isFinite(item.similarity) &&
    [item.sector, item.decision, item.reason].every(
      (entry) => entry === undefined || typeof entry === "string",
    )
  );
}

export function isDealAnalysis(value: unknown): value is DealAnalysis {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.summary === "string" &&
    item.summary.length <= 30_000 &&
    typeof item.recommendation === "string" &&
    item.recommendation.length <= 30_000 &&
    strings(item.positiveSignals) &&
    strings(item.risks) &&
    strings(item.founderQuestions) &&
    Array.isArray(item.similarCompanies) &&
    item.similarCompanies.length <= 100 &&
    item.similarCompanies.every(comparable)
  );
}

/** Never trust storage content; restore only this version's bounded data shape. */
export function parseAnalysisSession(
  serialized: string,
): AnalysisSession | null {
  if (serialized.length > ANALYSIS_SESSION_LIMIT) return null;
  try {
    const data = JSON.parse(serialized) as Partial<AnalysisSession> | null;
    if (
      !data ||
      data.version !== 1 ||
      !["file", "text"].includes(data.mode ?? "") ||
      typeof data.text !== "string" ||
      data.text.length > 120_000 ||
      typeof data.filename !== "string" ||
      data.filename.length > 1_000 ||
      typeof data.analyzedName !== "string" ||
      data.analyzedName.length > 1_000 ||
      (data.analysis !== null && !isDealAnalysis(data.analysis))
    )
      return null;
    return data as AnalysisSession;
  } catch {
    return null;
  }
}
