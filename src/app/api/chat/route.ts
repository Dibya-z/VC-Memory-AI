import { NextResponse } from "next/server";
import { CHAT_LIMITS, chatRequestSchema } from "@/lib/validators";
import { answerFromMemory } from "@/lib/ai/chat";

/**
 * POST /api/chat — Feature 2 memory chatbot.
 * Body: { message, history?, activeCompanyId? }. Context stays request-scoped.
 * Returns a plain-text answer, verified citations, status and retrieval trace.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow time for embed + LLM completion on serverless (Vercel default is 10s).
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    const declaredLength = Number(req.headers.get("content-length") ?? 0);
    if (declaredLength > CHAT_LIMITS.bodyBytes) {
      return NextResponse.json({ error: "Chat request is too large." }, { status: 413 });
    }
    // Count actual bytes as well: a missing or incorrect length cannot bypass
    // the limit, and validation never materializes an unbounded JSON body.
    const reader = req.body?.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let content = "";
    if (reader) {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > CHAT_LIMITS.bodyBytes) {
          await reader.cancel();
          return NextResponse.json({ error: "Chat request is too large." }, { status: 413 });
        }
        content += decoder.decode(part.value, { stream: true });
      }
    }
    body = JSON.parse(content + decoder.decode());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a message of 1–4000 characters and at most 12 recent user/assistant messages (16000 context characters total)." },
      { status: 400 }
    );
  }

  try {
    const result = await answerFromMemory(parsed.data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error: "Memory is temporarily unavailable. Please try again.",
      },
      { status: 500 }
    );
  }
}
