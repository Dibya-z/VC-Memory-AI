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
 * Failure handling: text extraction runs first, so an unreadable file throws
 * before any row is created (the route reports it cleanly). Once a Document
 * exists, any later failure flips its status to "failed" with the error
 * captured, leaving the rest of the corpus untouched. The Voyage embedding
 * call is a network request, so it is deliberately kept outside any DB
 * transaction.
 */

import { extractText } from "@/lib/ingest/extract-text";
import { chunkText } from "@/lib/ingest/chunk";
import { extractIntelligence } from "@/lib/ai/extract";
import { embed } from "@/lib/embeddings";
import {
  createDocument,
  updateDocument,
  setDocumentStatus,
  upsertCompanyFromExtraction,
  saveChunks,
} from "@/lib/db/queries";
import type { ExtractedIntelligence } from "@/lib/types";

/** Voyage accepts large batches; we cap per request to stay well within limits. */
const EMBED_BATCH = 96;

export interface IngestInput {
  buffer: Buffer;
  filename: string;
  mime: string;
  /** Optional override for first/last-met dates (used by the demo seeder). */
  metAt?: Date;
}

export interface IngestResult {
  documentId: string;
  companyId: string;
  intelligence: ExtractedIntelligence;
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  // 1. Extract text up front — a bad file fails here, before any DB write.
  const { text, fileType } = await extractText({
    buffer: input.buffer,
    filename: input.filename,
    mime: input.mime,
  });

  // 2. Create the Document row in "processing" state.
  const doc = await createDocument({
    filename: input.filename,
    fileType,
    rawText: text,
    sizeBytes: input.buffer.byteLength,
    status: "processing",
  });

  try {
    // 3. Structured extraction (Groq) → 4. upsert Company memory.
    const intelligence = await extractIntelligence(text);
    const company = await upsertCompanyFromExtraction(intelligence, {
      metAt: input.metAt,
    });

    // 5. Link the document to its company + record the doc type.
    await updateDocument(doc.id, {
      companyId: company.id,
      docType: intelligence.docType ?? null,
    });

    // 6. Chunk → embed → store the semantic index.
    const chunks = chunkText(text);
    const vectors = await embedInBatches(chunks);
    await saveChunks(
      doc.id,
      company.id,
      chunks.map((content, i) => ({ content, ordinal: i, embedding: vectors[i] }))
    );

    // 7. Done.
    await setDocumentStatus(doc.id, "processed");

    return { documentId: doc.id, companyId: company.id, intelligence };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setDocumentStatus(doc.id, "failed", message);
    throw err;
  }
}

async function embedInBatches(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    out.push(...(await embed(batch, "document")));
  }
  return out;
}
