import { NextResponse } from "next/server";
import { listCompanies } from "@/lib/db/queries";

/**
 * GET /api/companies — list companies for the Company Memory page.
 * Supports query filters: ?sector=&decision=&stage=
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // reflects live DB; never prerender

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companies = await listCompanies({
    sector: searchParams.get("sector") ?? undefined,
    decision: searchParams.get("decision") ?? undefined,
    stage: searchParams.get("stage") ?? undefined,
  });
  return NextResponse.json({ companies });
}
