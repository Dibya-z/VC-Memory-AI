/**
 * Shared application types. DB row shapes come from Prisma (`@prisma/client`);
 * these describe the JSON-valued fields and the AI/RAG payloads that cross the
 * client/server boundary.
 */

import type { Decision, DocType, Sector, Stage } from "@/config/constants";

export interface Founder {
  name: string;
  role?: string;
  background?: string;
}

/**
 * The structured investment intelligence the LLM extracts from a document.
 * Mirrors the `Company` model's content fields. Produced by lib/ai/extract.ts
 * via Claude structured outputs.
 */
export interface ExtractedIntelligence {
  company: string;
  sector?: Sector | string;
  stage?: Stage | string;
  oneLiner?: string;
  problem?: string;
  solution?: string;
  businessModel?: string;
  market?: string;
  traction?: string;
  competition?: string;
  founders?: Founder[];
  strengths?: string[];
  risks?: string[];
  concerns?: string[];
  decision?: Decision | null;
  decisionReason?: string | null;
  docType?: DocType;
}

/** A retrieved chunk with its similarity score (RAG). */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  companyId: string | null;
  companyName: string | null;
  content: string;
  score: number; // cosine similarity, 0..1
}

/** A grounding reference shown under an assistant chat answer. */
export interface Citation {
  companyId: string | null;
  companyName: string | null;
  snippet: string;
}

/** New-deal analysis output (Feature 3). */
export interface DealAnalysis {
  summary: string;
  positiveSignals: string[];
  risks: string[];
  founderQuestions: string[];
  similarCompanies: SimilarCompany[];
  recommendation: string; // e.g. "Interesting signal — needs partner review"
}

export interface SimilarCompany {
  companyId: string;
  name: string;
  sector?: string;
  decision?: string;
  reason?: string; // why it's comparable / what happened
  similarity: number;
}

/** Investment brief output (Feature 4). */
export interface InvestmentBrief {
  company: string;
  overview: string;
  problem: string;
  solution: string;
  market: string;
  founderSignals: string;
  traction: string;
  strengths: string[];
  risks: string[];
  similarPastDeals: SimilarCompany[];
  questionsForFounder: string[];
  recommendation: string;
}

/** A company row for the Company Memory list (Step 3). */
export interface CompanyListItem {
  id: string;
  name: string;
  sector: string | null;
  stage: string | null;
  decision: string | null;
  oneLiner: string | null;
  lastMetAt: string | null; // ISO
  strengthsCount: number;
  risksCount: number;
  documentCount: number;
}

/** A source document shown on the company detail page. */
export interface CompanyDocument {
  id: string;
  filename: string;
  fileType: string;
  docType: string | null;
  createdAt: string; // ISO
}

/** Full company record for the detail page (JSON fields parsed, dates as ISO). */
export interface CompanyDetail {
  id: string;
  name: string;
  sector: string | null;
  stage: string | null;
  oneLiner: string | null;
  problem: string | null;
  solution: string | null;
  businessModel: string | null;
  market: string | null;
  traction: string | null;
  competition: string | null;
  founders: Founder[];
  strengths: string[];
  risks: string[];
  concerns: string[];
  decision: string | null;
  decisionReason: string | null;
  firstMetAt: string | null; // ISO
  lastMetAt: string | null; // ISO
  documents: CompanyDocument[];
}

/** Per-file result returned by POST /api/upload (Feature 1). */
export interface UploadResult {
  filename: string;
  ok: boolean;
  error?: string;
  companyId?: string;
  documentId?: string;
  intelligence?: ExtractedIntelligence;
}

/** Dashboard summary stats (Feature: Dashboard). */
export interface DashboardStats {
  companyCount: number;
  documentCount: number;
  sectorBreakdown: { sector: string; count: number }[];
  decisionBreakdown: { decision: string; count: number }[];
  recentUploads: {
    id: string;
    filename: string;
    companyName: string | null;
    createdAt: string;
  }[];
}
