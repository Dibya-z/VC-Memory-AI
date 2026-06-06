import { NextResponse } from "next/server";

/**
 * POST /api/analyze — Feature 3 new-deal analysis + memory comparison.
 * Accepts a new startup deck (multipart). Extracts it, finds similar past deals
 * in memory, returns DealAnalysis. Does NOT persist by default (it's a new,
 * not-yet-decided deal) — optionally save on confirm.
 *
 * TODO(impl): extract text -> ai/analyze.analyzeNewDeal -> return analysis.
 */
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
