/**
 * Renders an InvestmentBrief (Feature 4): a partner-ready memo with the standard
 * sections, closing on a HEDGED recommendation ("Worth a closer look" /
 * "Needs partner review" / "Needs more diligence") — never a final decision.
 * Pure presentational; editorial "confident restraint" styling.
 */

import Link from "next/link";
import { Chip, DecisionBadge } from "@/components/ui/badges";
import { BulletList } from "@/components/ui/BulletList";
import type { InvestmentBrief, SimilarCompany } from "@/lib/types";

export function BriefReport({ brief }: { brief: InvestmentBrief }) {
  return (
    <article className="space-y-10">
      <section>
        <h2 className="label-eyebrow mb-3">Overview</h2>
        <p className="text-[16px] leading-relaxed">{brief.overview}</p>
      </section>

      <div className="grid gap-x-10 gap-y-6 border-t border-border pt-8 sm:grid-cols-2">
        <Field label="Problem" value={brief.problem} />
        <Field label="Solution" value={brief.solution} />
        <Field label="Market" value={brief.market} />
        <Field label="Traction" value={brief.traction} />
        <Field label="Founder signals" value={brief.founderSignals} />
      </div>

      {(brief.strengths.length > 0 || brief.risks.length > 0) && (
        <div className="grid gap-x-10 gap-y-6 border-t border-border pt-8 sm:grid-cols-2">
          <BulletList label="Strengths" items={brief.strengths} tone="success" />
          <BulletList label="Risks" items={brief.risks} tone="danger" />
        </div>
      )}

      {brief.similarPastDeals.length > 0 && (
        <section className="border-t border-border pt-8">
          <h2 className="label-eyebrow mb-1">Comparable past deals</h2>
          <p className="mb-6 text-[14px] text-muted-foreground">
            What the firm concluded on the closest comparable companies.
          </p>
          <div className="space-y-5">
            {brief.similarPastDeals.map((c) => (
              <SimilarRow key={c.companyId} c={c} />
            ))}
          </div>
        </section>
      )}

      {brief.questionsForFounder.length > 0 && (
        <section className="border-t border-border pt-8">
          <h2 className="label-eyebrow mb-4">Questions for the founders</h2>
          <ol className="space-y-2.5">
            {brief.questionsForFounder.map((q, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Hedged recommendation — accent highlight, the memo's close */}
      <div className="border-l-2 border-accent pl-5">
        <p className="label-eyebrow mb-2">Recommendation</p>
        <p className="text-[16px] leading-relaxed">{brief.recommendation}</p>
      </div>
    </article>
  );
}

function SimilarRow({ c }: { c: SimilarCompany }) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/companies/${c.companyId}`}
          className="text-[15px] font-medium underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {c.name}
        </Link>
        {c.sector && <Chip>{c.sector}</Chip>}
        {c.decision && <DecisionBadge decision={c.decision} />}
        <span className="label-eyebrow ml-auto tabular-nums">
          {Math.round(c.similarity * 100)}% match
        </span>
      </div>
      {c.reason && (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {c.reason}
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="label-eyebrow mb-1.5">{label}</p>
      <p className="text-[15px] leading-relaxed">{value}</p>
    </div>
  );
}
