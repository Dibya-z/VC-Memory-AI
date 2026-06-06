/**
 * The ingestion pipeline — the heart of "every document becomes memory".
 *
 *   Document buffer
 *        │  extractText()          (ingest/extract-text)
 *        ▼
 *     raw text  ──────────────► extractIntelligence()   (ai/extract)
 *        │                              │
 *        │ chunkText()                  ▼
 *        ▼                       upsert Company (structured memory)
 *     chunks ── embed() ──► store Chunk + embedding (RAG index)
 *
 * Persists a Document, upserts/links a Company from the extracted intelligence,
 * and writes embedded Chunks so the content is immediately searchable.
 *
 * Used by both the upload route (Feature 1) and the demo seeder (scripts/).
 *
 * TODO(impl): orchestrate the steps above inside a transaction; set Document
 * status to "processing" -> "processed"/"failed" with the error captured.
 */

import type { ExtractedIntelligence } from "@/lib/types";

export interface IngestInput {
  buffer: Buffer;
  filename: string;
  mime: string;
}

export interface IngestResult {
  documentId: string;
  companyId: string;
  intelligence: ExtractedIntelligence;
}

export async function ingestDocument(
  _input: IngestInput
): Promise<IngestResult> {
  throw new Error("ingestDocument: not implemented yet");
}
