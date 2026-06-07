/**
 * Feature 2 — VC Memory chatbot (RAG).
 *
 * Pipeline:
 *   1. Embed the user's question (lib/embeddings).
 *   2. Retrieve top-K relevant chunks from the vector store (lib/vector).
 *   3. Assemble the retrieved memory into a grounded prompt.
 *   4. Ask the LLM (Groq) to answer using ONLY that memory.
 *   5. Return the answer plus citations to the companies that grounded it.
 */

import { complete } from "@/lib/ai/llm";
import { CHAT_SYSTEM } from "@/lib/ai/prompts";
import { embedOne } from "@/lib/embeddings";
import { vectorStore } from "@/lib/vector/local-store";
import type { Citation } from "@/lib/types";

/** Chunks retrieved per chat query. Slightly leaner than RAG.TOP_K to keep the
 *  grounded context (and token spend) modest — chat is high-frequency. */
const CHAT_TOP_K = 6;

export interface ChatResult {
  answer: string;
  citations: Citation[];
}

export async function answerFromMemory(question: string): Promise<ChatResult> {
  const queryEmbedding = await embedOne(question, "query");
  const chunks = await vectorStore.search(queryEmbedding, { topK: CHAT_TOP_K });

  if (chunks.length === 0) {
    return {
      answer:
        "There's nothing in the firm's memory yet. Upload some documents (or run the demo ingest) and ask again.",
      citations: [],
    };
  }

  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.companyName ?? "Unknown company"}\n${c.content.trim()}`
    )
    .join("\n\n---\n\n");

  const userContent = `Firm memory (retrieved context):\n\n${context}\n\nQuestion: ${question}\n\nAnswer using only the memory above.`;

  // Chat uses the default 70B reasoning model for precise grounding (it
  // distinguishes Passed / Tracking / Invested reliably). maxTokens kept modest
  // since grounded answers are short.
  const answer = await complete(userContent, {
    system: CHAT_SYSTEM,
    maxTokens: 900,
    temperature: 0.3,
  });

  return { answer: answer.trim(), citations: buildCitations(chunks) };
}

/** One citation per company (first occurrence), in retrieval order. */
function buildCitations(
  chunks: { companyId: string | null; companyName: string | null; content: string }[]
): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const c of chunks) {
    const key = c.companyId ?? c.companyName ?? "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    citations.push({
      companyId: c.companyId,
      companyName: c.companyName,
      snippet: snippet(c.content),
    });
    if (citations.length >= 5) break;
  }
  return citations;
}

function snippet(text: string, max = 160): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}
