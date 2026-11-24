import { NextResponse } from "next/server";
import { searchCompanies } from "@/lib/db/queries";
import { parseCompanyDirectoryParams } from "@/lib/company-discovery";

/** GET /api/companies — bounded name search, facets, sorting and pagination. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const values = Object.fromEntries(
    ["q", "sector", "decision", "stage", "sort", "page"].map((key) => {
      const entries = searchParams.getAll(key);
      return [key, entries.length > 1 ? entries : entries[0]];
    }),
  );
  const options = parseCompanyDirectoryParams(values);
  const result = await searchCompanies(options);
  return NextResponse.json(result);
}
