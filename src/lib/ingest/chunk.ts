/**
 * Splits document text into overlapping chunks for embedding/retrieval.
 * Defaults from config/constants RAG.{CHUNK_SIZE, CHUNK_OVERLAP}. Prefers to
 * break on paragraph/sentence boundaries so chunks stay coherent.
 *
 * TODO(impl): boundary-aware sliding window with overlap.
 */

import { RAG } from "@/config/constants";

export function chunkText(
  _text: string,
  _opts: { size?: number; overlap?: number } = {}
): string[] {
  void RAG;
  throw new Error("chunkText: not implemented yet");
}
