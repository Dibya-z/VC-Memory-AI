import type { ExtractedIntelligence } from "@/lib/types";
import type { ExtractedText } from "./extract-text";

export const INGESTION_LEASE_MS = 120_000;
export interface IngestionResult {
  documentId: string;
  companyId: string;
  intelligence: ExtractedIntelligence;
  reused?: boolean;
}
export interface OwnedIngestion {
  key: string;
  ownerToken: string;
  documentId: string;
  metAt: Date;
}
export type IngestionClaim =
  | { kind: "owned"; claim: OwnedIngestion }
  | { kind: "complete"; result: IngestionResult }
  | { kind: "busy"; retryAfterSeconds: number };
export interface ClaimInput {
  key: string;
  ownerToken: string;
  filename: string;
  fileType: ExtractedText["fileType"];
  sizeBytes: number;
  metAt: Date;
}
export interface IngestionCompletion {
  text: string;
  intelligence: ExtractedIntelligence;
  chunks: { content: string; ordinal: number; embedding: number[] }[];
}
export interface IngestionRepository {
  claim(input: ClaimInput): Promise<IngestionClaim>;
  renew(claim: OwnedIngestion): Promise<boolean>;
  complete(
    claim: OwnedIngestion,
    input: IngestionCompletion,
  ): Promise<IngestionResult>;
  fail(claim: OwnedIngestion): Promise<void>;
}
export class UploadInProgressError extends Error {
  constructor(
    public readonly retryAfterSeconds = Math.ceil(INGESTION_LEASE_MS / 1000),
  ) {
    super(
      "This document is already being processed. Check Company Memory, then retry after the suggested wait.",
    );
    this.name = "UploadInProgressError";
  }
}
export class IngestionLeaseLostError extends UploadInProgressError {
  constructor() {
    super();
    this.message =
      "This upload attempt no longer owns processing. A retry may be running; check Company Memory before retrying.";
    this.name = "IngestionLeaseLostError";
  }
}
