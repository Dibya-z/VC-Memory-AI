/**
 * Feature 2 — VC Memory chatbot (RAG).
 *
 * Pipeline:
 *   1. Embed the user's question (lib/embeddings).
 *   2. Retrieve top-K relevant chunks from the vector store (lib/vector).
 *   3. Assemble the retrieved memory + matched companies into a grounded prompt.
 *   4. Ask Claude to answer using ONLY that memory, returning citations.
 *
 * Returns the assistant text plus the citations that grounded it.
 *
 * TODO(impl): wire embeddings -> retrieval -> Claude with CHAT_SYSTEM.
 */

import type { Citation } from "@/lib/types";

export interface ChatResult {
  answer: string;
  citations: Citation[];
}

export async function answerFromMemory(_question: string): Promise<ChatResult> {
  throw new Error("answerFromMemory: not implemented yet");
}
