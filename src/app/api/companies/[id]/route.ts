import { NextResponse } from "next/server";
import { getCompany } from "@/lib/db/queries";

/**
 * GET /api/companies/[id] — full company record + documents for the detail page.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // reflects live DB; never prerender

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const company = await getCompany(ctx.params.id);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  return NextResponse.json({ company });
}
