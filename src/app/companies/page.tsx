/**
 * Company Memory page. Lists every startup the firm has stored, filterable by
 * sector, decision, and stage (server-side via the URL query string).
 */

import Link from "next/link";
import { Building2, ArrowUpRight } from "lucide-react";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CompanyFilters } from "@/components/companies/CompanyFilters";
import { listCompanies } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { sector?: string; decision?: string; stage?: string };
}) {
  const filters = {
    sector: searchParams.sector,
    decision: searchParams.decision,
    stage: searchParams.stage,
  };
  const companies = await listCompanies(filters);
  const filtered = Boolean(filters.sector || filters.decision || filters.stage);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Company memory</h1>
        <p className="text-sm text-muted-foreground">
          Every startup you&apos;ve reviewed — filter by sector, decision, or stage.
        </p>
      </div>

      <CompanyFilters current={filters} />

      {companies.length === 0 ? (
        filtered ? (
          <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No companies match these filters.
          </p>
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {companies.length} compan{companies.length === 1 ? "y" : "ies"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">No companies in memory yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a document to extract and store your first company.
      </p>
      <Link
        href="/upload"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Upload documents <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
