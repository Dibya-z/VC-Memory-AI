import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CompanyFilters } from "@/components/companies/CompanyFilters";
import { searchCompanies } from "@/lib/db/queries";
import {
  companyDirectoryHref,
  parseCompanyDirectoryParams,
} from "@/lib/company-discovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Company memory" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCompanyDirectoryParams(await searchParams);
  const { companies, total, page, pageSize, pageCount, facets } =
    await searchCompanies(filters);
  const filtered = Boolean(
    filters.q || filters.sector || filters.decision || filters.stage,
  );
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Companies"
        title="Company memory"
        description="Find a company by name, or explore the sectors, decisions, and stages recorded in memory."
      />
      <CompanyFilters
        current={{
          q: filters.q,
          sector: filters.sector,
          decision: filters.decision,
          stage: filters.stage,
          sort: filters.sort,
        }}
        facets={facets}
      />
      <section aria-labelledby="company-results" className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <h2 id="company-results" className="label-eyebrow">
            Companies
          </h2>
          <p role="status" className="text-sm text-muted-foreground">
            {total
              ? `Showing ${start}–${end} of ${total} ${total === 1 ? "company" : "companies"}`
              : "0 companies"}
          </p>
        </div>
        {companies.length ? (
          <div className="grid min-w-0 gap-x-10 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : filtered ? (
          <div className="space-y-3 py-8">
            <h3 className="text-lg font-medium">
              No companies match this search
            </h3>
            <p className="text-muted-foreground">
              Try a different name or remove a filter.
            </p>
            <Link
              href="/companies"
              className="text-link inline-flex min-h-11 items-center"
            >
              Clear search and filters
            </Link>
          </div>
        ) : (
          <EmptyState />
        )}
        {pageCount > 1 && (
          <nav
            aria-label="Company result pages"
            className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6"
          >
            {page > 1 ? (
              <Link
                href={companyDirectoryHref({ ...filters, page: page - 1 })}
                className="text-link inline-flex min-h-11 items-center"
              >
                Previous page
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link
                href={companyDirectoryHref({ ...filters, page: page + 1 })}
                className="text-link inline-flex min-h-11 items-center"
              >
                Next page
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
function EmptyState() {
  return (
    <div className="max-w-prose space-y-4 py-8">
      <h3 className="font-serif text-3xl font-normal tracking-tight">
        No companies in memory yet
      </h3>
      <p className="text-muted-foreground">
        Upload a document to extract and store your first company.
      </p>
      <Link
        href="/upload"
        className="inline-flex min-h-11 items-center bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
      >
        Upload documents
      </Link>
    </div>
  );
}
