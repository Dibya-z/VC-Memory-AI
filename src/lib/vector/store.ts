/**
 * VectorStore — the retrieval seam.
 *
 * The app talks to this interface, never a concrete store. The default
 * implementation (local-store.ts) reads embeddings straight out of SQLite and
 * does cosine similarity in memory — perfect for a prototype at the hundreds/
 * thousands-of-docs scale, with zero extra infrastructure. To move to ChromaDB,
 * Pinecone, or Supabase pgvector later, implement this same interface.
 */

import type { RetrievedChunk } from "@/lib/types";

export interface VectorSearchOptions {
  topK?: number;
  /** Restrict search to a single company (e.g. brief generation). */
  companyId?: string;
  /** Exclude a company from results (e.g. don't match a new deal to itself). */
  excludeCompanyId?: string;
}

export interface VectorStore {
  /** Semantic search by a pre-computed query embedding. */
  search(
    queryEmbedding: number[],
    options?: VectorSearchOptions
  ): Promise<RetrievedChunk[]>;
}
