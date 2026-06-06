import { NextResponse } from "next/server";

/**
 * GET /api/companies — list companies for the Company Memory page.
 * Supports query filters: ?sector=&decision=&stage=&q=
 *
 * TODO(impl): lib/db/queries.listCompanies(filters).
 */
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
