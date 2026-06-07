import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBrief } from "@/lib/ai/brief";

/**
 * POST /api/brief — Feature 4 investment brief generation.
 * Body: { companyId }. Generates a partner-ready memo (ai/brief.generateBrief)
 * with a hedged recommendation, grounded in the company's recorded memory and
 * its closest comparable past deals. Returns { brief: InvestmentBrief }.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow time for embed + memory search + LLM brief writing (Vercel default 10s).
export const maxDuration = 60;

const briefRequestSchema = z.object({ companyId: z.string().min(1) });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = briefRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A companyId is required." }, { status: 400 });
  }

  try {
    const brief = await generateBrief(parsed.data.companyId);
    return NextResponse.json({ brief });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Brief generation failed.";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
