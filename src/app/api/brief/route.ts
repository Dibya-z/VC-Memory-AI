import { NextResponse } from "next/server";

/**
 * POST /api/brief — Feature 4 investment brief generation.
 * Body: { companyId }. Generates a partner-ready memo (ai/brief.generateBrief)
 * with hedged recommendation language. Returns InvestmentBrief.
 *
 * TODO(impl): validate with briefRequestSchema, call generateBrief.
 */
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
