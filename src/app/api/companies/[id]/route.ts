import { NextResponse } from "next/server";

/**
 * GET /api/companies/[id] — full company record + documents for the detail page.
 *
 * TODO(impl): lib/db/queries.getCompany(id); 404 when missing.
 */
export async function GET(
  _req: Request,
  _ctx: { params: { id: string } }
) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
