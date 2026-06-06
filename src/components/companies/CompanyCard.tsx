/**
 * Company summary card for the Company Memory grid: name, sector, stage, a
 * decision badge, and a one-liner. Links to the company detail page.
 */

import Link from "next/link";
import { Chip, DecisionBadge } from "@/components/ui/badges";
import { timeAgo } from "@/lib/utils";
import type { CompanyListItem } from "@/lib/types";

export function CompanyCard({ company }: { company: CompanyListItem }) {
  return (
    <Link
      href={`/companies/${company.id}`}
      className="group block rounded-lg border bg-card p-5 transition-colors hover:border-accent/50 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold tracking-tight group-hover:text-accent">
          {company.name}
        </h3>
        {company.decision && <DecisionBadge decision={company.decision} />}
      </div>

      {(company.sector || company.stage) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {company.sector && <Chip>{company.sector}</Chip>}
          {company.stage && <Chip>{company.stage}</Chip>}
        </div>
      )}

      {company.oneLiner && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {company.oneLiner}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{company.strengthsCount} strengths</span>
        <span>{company.risksCount} risks</span>
        <span>
          {company.documentCount} doc{company.documentCount === 1 ? "" : "s"}
        </span>
        {company.lastMetAt && <span>· {timeAgo(company.lastMetAt)}</span>}
      </div>
    </Link>
  );
}
