import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/validators";
import { answerFromMemory } from "@/lib/ai/chat";

/**
 * POST /api/chat — Feature 2 memory chatbot.
 * Body: { message }. Runs RAG (embed → retrieve → ground) and returns
 * { answer, citations }. Stateless for now; the client keeps conversation state.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A non-empty 'message' is required." },
      { status: 400 }
    );
  }

  try {
    const result = await answerFromMemory(parsed.data.message);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to answer from memory.",
      },
      { status: 500 }
    );
  }
}
