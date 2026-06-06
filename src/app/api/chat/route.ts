import { NextResponse } from "next/server";

/**
 * POST /api/chat — Feature 2 memory chatbot.
 * Body: { message, conversationId? }. Runs RAG (ai/chat.answerFromMemory),
 * persists the turn, returns { answer, citations, conversationId }.
 *
 * TODO(impl): validate with chatRequestSchema, call answerFromMemory, store
 * Message rows. Consider streaming the response later.
 */
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
