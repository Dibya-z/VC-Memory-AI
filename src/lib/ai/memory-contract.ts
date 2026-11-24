/** Request-scoped contracts shared by Memory Chat's planner and evidence layer. */
export interface MemoryCompany {
  id: string;
  name: string;
  sector: string | null;
  decision: string | null;
  decisionReason: string | null;
  firstMetAt: string | null;
  lastMetAt: string | null;
  updatedAt: string;
}

export interface MemoryFilters {
  sector?: string;
  decision?: "Interested" | "Passed" | "Invested" | "Tracking";
  /** Filters apply to the current record's last recorded interaction, never upload time. */
  metAfter?: string;
  metBefore?: string;
}

export type MemoryIntent = "inventory" | "count" | "filtered_list" | "company_recall" |
  "comparison" | "meeting_preparation" | "semantic_explanation" | "clarification";

export interface QueryPlan {
  intent: MemoryIntent;
  companyIds: string[];
  filters: MemoryFilters;
  standaloneQuestion: string;
  clarification?: string;
  unknownCompany?: string;
}

export interface MemoryDocument {
  id: string;
  companyId: string | null;
  companyName: string | null;
  filename: string;
  docType: string | null;
  rawText: string;
  uploadedAt: string;
  chunks: { id: string; content: string; ordinal: number }[];
}

export interface MemoryRepository {
  catalog(): Promise<MemoryCompany[]>;
  list(filters: MemoryFilters): Promise<MemoryCompany[]>;
  count(filters: MemoryFilters): Promise<number>;
  documents(companyIds: string[]): Promise<MemoryDocument[]>;
}

export interface MemoryEvidence {
  id: string;
  kind: "document" | "company_record";
  companyId: string | null;
  companyName: string | null;
  documentId: string | null;
  documentName: string | null;
  documentType: string | null;
  chunkId: string | null;
  text: string;
  /** Verified character offsets into retained source text (end exclusive). */
  start: number;
  end: number;
  sourceDate: string | null;
  uploadedAt: string | null;
}

export interface EvidenceSelection {
  evidence: MemoryEvidence[];
  sufficient: boolean;
  reason: string;
  omittedDocuments: number;
}
