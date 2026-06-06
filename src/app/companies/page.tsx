/**
 * Company Memory page. Lists every startup the firm has stored, filterable by
 * sector, decision, and stage (server-side via the URL query string).
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
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
    <div className="space-y-12 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Companies"
        title="Company memory"
        description="Every startup the firm has reviewed — filter by sector, decision, or stage."
      />

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CompanyFilters current={filters} />
          {companies.length > 0 && (
            <span className="label-eyebrow">
              {companies.length} compan{companies.length === 1 ? "y" : "ies"}
            </span>
          )}
        </div>

        {companies.length === 0 ? (
          filtered ? (
            <p className="border-t border-border pt-12 text-[15px] text-muted-foreground">
              No companies match these filters.
            </p>
          ) : (
            <EmptyState />
          )
        ) : (
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="max-w-[680px] border-t border-border pt-12">
      <h2 className="font-serif text-3xl font-normal tracking-tight">
        No companies in memory yet
      </h2>
      <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
        Upload a document to extract and store your first company.
      </p>
      <Link
        href="/upload"
        className="group mt-8 inline-flex h-12 items-center gap-2 bg-primary px-8 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Upload documents
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.5}
        />
      </Link>
    </section>
  );
}
