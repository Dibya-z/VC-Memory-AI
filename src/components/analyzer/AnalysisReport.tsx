/**
 * Renders a DealAnalysis (Feature 3): summary, a hedged recommendation, positive
 * signals / risks, founder questions, and the most similar past deals from
 * memory (the comparison payoff). Editorial, restrained styling.
 */

import Link from "next/link";
import { BulletList } from "@/components/ui/BulletList";
import { Chip, DecisionBadge } from "@/components/ui/badges";
import type { DealAnalysis, SimilarCompany } from "@/lib/types";

export function AnalysisReport({ analysis }: { analysis: DealAnalysis }) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="label-eyebrow mb-3">Summary</h2>
        <p className="text-[16px] leading-relaxed">{analysis.summary}</p>
      </section>

      {/* Hedged recommendation — accent highlight */}
      <div className="border-l-2 border-accent pl-5">
        <p className="label-eyebrow mb-2">Recommendation</p>
        <p className="text-[16px] leading-relaxed">{analysis.recommendation}</p>
      </div>

      {(analysis.positiveSignals.length > 0 || analysis.risks.length > 0) && (
        <div className="grid gap-x-10 gap-y-6 border-t border-border pt-8 sm:grid-cols-2">
          <BulletList
            label="Positive signals"
            items={analysis.positiveSignals}
            tone="success"
          />
          <BulletList label="Risks" items={analysis.risks} tone="danger" />
        </div>
      )}

      {analysis.founderQuestions.length > 0 && (
        <section className="border-t border-border pt-8">
          <h2 className="label-eyebrow mb-4">Questions for the founders</h2>
          <ol className="space-y-2.5">
            {analysis.founderQuestions.map((q, i) => (
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

      {analysis.similarCompanies.length > 0 && (
        <section className="border-t border-border pt-8">
          <h2 className="label-eyebrow mb-1">Similar past deals in memory</h2>
          <p className="mb-6 text-[14px] text-muted-foreground">
            What the firm concluded on the closest comparable companies.
          </p>
          <div className="space-y-5">
            {analysis.similarCompanies.map((c) => (
              <SimilarRow key={c.companyId} c={c} />
            ))}
          </div>
        </section>
      )}
    </div>
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
