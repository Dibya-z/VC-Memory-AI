import { NextResponse } from "next/server";

/**
 * GET /api/stats — dashboard summary.
 * Returns DashboardStats: company/document counts, sector & decision
 * breakdowns, and recent uploads.
 *
 * TODO(impl): aggregate via lib/db/queries.getDashboardStats().
 */
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
