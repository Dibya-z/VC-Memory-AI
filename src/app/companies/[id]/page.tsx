/**
 * Company detail page. Shows the full extracted intelligence for one startup,
 * its decision memory, and its source documents. Reads the query layer directly.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Chip, DecisionBadge } from "@/components/ui/badges";
import { BulletList } from "@/components/ui/BulletList";
import { getCompany } from "@/lib/db/queries";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const company = await getCompany(params.id);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Company memory
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
          {company.decision && <DecisionBadge decision={company.decision} />}
        </div>
        {(company.sector || company.stage) && (
          <div className="flex flex-wrap gap-1.5">
            {company.sector && <Chip>{company.sector}</Chip>}
            {company.stage && <Chip>{company.stage}</Chip>}
          </div>
        )}
        {company.oneLiner && (
          <p className="text-base text-muted-foreground">{company.oneLiner}</p>
        )}
        {(company.firstMetAt || company.lastMetAt) && (
          <p className="text-xs text-muted-foreground">
            {company.firstMetAt && <>First met {timeAgo(company.firstMetAt)}</>}
            {company.firstMetAt && company.lastMetAt && " · "}
            {company.lastMetAt && <>last activity {timeAgo(company.lastMetAt)}</>}
          </p>
        )}
      </div>

      {/* Decision memory */}
      {company.decision && company.decisionReason && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Decision memory
            </span>
            <DecisionBadge decision={company.decision} />
          </div>
          <p className="text-sm">{company.decisionReason}</p>
        </div>
      )}

      {/* Narrative fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Problem" value={company.problem} />
        <Field label="Solution" value={company.solution} />
        <Field label="Market" value={company.market} />
        <Field label="Business model" value={company.businessModel} />
        <Field label="Traction" value={company.traction} />
        <Field label="Competition" value={company.competition} />
      </div>

      {/* Founders */}
      {company.founders.length > 0 && (
        <section>
          <SectionTitle>Founders</SectionTitle>
          <ul className="space-y-2">
            {company.founders.map((f, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{f.name}</span>
                {f.role ? ` — ${f.role}` : ""}
                {f.background && (
                  <span className="block text-muted-foreground">{f.background}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Assessment */}
      {(company.strengths.length > 0 ||
        company.risks.length > 0 ||
        company.concerns.length > 0) && (
        <div className="grid gap-5 sm:grid-cols-2">
          <BulletList label="Strengths" items={company.strengths} tone="success" />
          <BulletList label="Risks" items={company.risks} tone="danger" />
          <BulletList label="Concerns" items={company.concerns} tone="warning" />
        </div>
      )}

      {/* Source documents */}
      {company.documents.length > 0 && (
        <section>
          <SectionTitle>Source documents</SectionTitle>
          <ul className="divide-y rounded-lg border">
            {company.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{d.filename}</span>
                {d.docType && <Chip>{formatDocType(d.docType)}</Chip>}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(d.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold">{children}</h2>;
}

function formatDocType(docType: string): string {
  return docType.replace(/_/g, " ");
}
