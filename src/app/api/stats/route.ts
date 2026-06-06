import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db/queries";

/**
 * GET /api/stats — dashboard summary (DashboardStats).
 * The dashboard page reads the query layer directly; this endpoint exists for
 * client-side or external consumers.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // reflects live DB; never prerender

export async function GET() {
  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
