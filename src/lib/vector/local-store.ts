/**
 * Local, dependency-free VectorStore: loads chunk embeddings from SQLite and
 * ranks them by cosine similarity in memory. No external vector DB required.
 *
 * For thousands of chunks this is plenty fast; revisit only if the corpus grows
 * large enough to need an ANN index.
 */

import { RAG } from "@/config/constants";
import { loadSearchChunks } from "@/lib/db/queries";
import { cosineSimilarity } from "@/lib/vector/similarity";
import type { RetrievedChunk } from "@/lib/types";
import type { VectorSearchOptions, VectorStore } from "@/lib/vector/store";

export class LocalVectorStore implements VectorStore {
  async search(
    queryEmbedding: number[],
    options: VectorSearchOptions = {}
  ): Promise<RetrievedChunk[]> {
    const topK = options.topK ?? RAG.TOP_K;

    const rows = await loadSearchChunks({
      companyId: options.companyId,
      excludeCompanyId: options.excludeCompanyId,
    });

    const scored: RetrievedChunk[] = [];
    for (const row of rows) {
      const embedding = row.embedding;
      if (!Array.isArray(embedding)) continue; // skip un-embedded chunks
      scored.push({
        chunkId: row.id,
        documentId: row.documentId,
        companyId: row.companyId,
        companyName: row.company?.name ?? null,
        content: row.content,
        score: cosineSimilarity(queryEmbedding, embedding as number[]),
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

/** Default store instance used across the app. */
export const vectorStore: VectorStore = new LocalVectorStore();
