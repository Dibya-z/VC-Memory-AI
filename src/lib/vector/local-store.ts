/**
 * Local, dependency-free VectorStore: loads chunk embeddings from SQLite and
 * ranks them by cosine similarity in memory. No external vector DB required.
 *
 * TODO(impl):
 *   1. Load chunks (id, companyId, content, embedding) honouring companyId /
 *      excludeCompanyId filters.
 *   2. cosineSimilarity(queryEmbedding, chunk.embedding) for each.
 *   3. Sort desc, take topK (default RAG.TOP_K), map to RetrievedChunk.
 *
 * For thousands of chunks this is plenty fast; revisit only if the corpus grows
 * large enough to need an ANN index.
 */

import type { RetrievedChunk } from "@/lib/types";
import type { VectorSearchOptions, VectorStore } from "@/lib/vector/store";

export class LocalVectorStore implements VectorStore {
  async search(
    _queryEmbedding: number[],
    _options?: VectorSearchOptions
  ): Promise<RetrievedChunk[]> {
    throw new Error("LocalVectorStore.search: not implemented yet");
  }
}

/** Default store instance used across the app. */
export const vectorStore: VectorStore = new LocalVectorStore();
