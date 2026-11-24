/**
 * Company summary for the Company Memory grid — editorial portfolio style:
 * a 1px top rule (no fill, no shadow, square) that turns accent on hover.
 * Links to the company detail page.
 */

import Link from "next/link";
import { Chip, DecisionBadge } from "@/components/ui/badges";
import { DateTime } from "@/components/ui/DateTime";
import type { CompanyListItem } from "@/lib/types";

export function CompanyCard({ company }: { company: CompanyListItem }) {
  return (
    <Link
      href={`/companies/${company.id}`}
      className="group block min-w-0 border-t border-border pt-5 transition-colors duration-200 hover:border-accent"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 [overflow-wrap:anywhere] text-lg font-medium tracking-tight">
          {company.name}
        </h3>
        {company.decision && <DecisionBadge decision={company.decision} />}
      </div>

      {(company.sector || company.stage) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {company.sector && <Chip>{company.sector}</Chip>}
          {company.stage && <Chip>{company.stage}</Chip>}
        </div>
      )}

      {company.oneLiner && (
        <p className="mt-4 line-clamp-2 [overflow-wrap:anywhere] text-sm leading-relaxed text-muted-foreground">
          {company.oneLiner}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span>{company.strengthsCount} strengths</span>
        <span>{company.risksCount} risks</span>
        <span>
          {company.documentCount} doc{company.documentCount === 1 ? "" : "s"}
        </span>
        {company.lastMetAt && (
          <span>
            Last interaction <DateTime value={company.lastMetAt} relative />
          </span>
        )}
      </div>
    </Link>
  );
}
