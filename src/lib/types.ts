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
