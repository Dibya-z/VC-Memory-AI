/**
 * Company detail page. Full extracted intelligence for one startup, its decision
 * memory, and what each source document contributed. Editorial "confident
 * restraint" styling. Reads the query layer directly.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Chip, DecisionBadge } from "@/components/ui/badges";
import { BulletList } from "@/components/ui/BulletList";
import { GenerateBriefButton } from "@/components/brief/GenerateBriefButton";
import { getCompany, getCompanyIdentity } from "@/lib/db/queries";
import { DateTime } from "@/components/ui/DateTime";
import type { CompanyDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const company = await getCompanyIdentity((await params).id);
  return { title: company ? company.name : "Company not found" };
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const company = await getCompany((await params).id);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-3xl min-w-0 [overflow-wrap:anywhere] space-y-12 pb-12">
      <Link
        href="/companies"
        className="label-eyebrow inline-flex items-center gap-2 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Company memory
      </Link>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-serif text-4xl font-normal tracking-tight">
            {company.name}
          </h1>
          {company.decision && <DecisionBadge decision={company.decision} />}
        </div>
        {(company.sector || company.stage) && (
          <div className="flex flex-wrap gap-2">
            {company.sector && <Chip>{company.sector}</Chip>}
            {company.stage && <Chip>{company.stage}</Chip>}
          </div>
        )}
        {company.oneLiner && (
          <p className="max-w-[620px] text-[18px] leading-relaxed text-muted-foreground">
            {company.oneLiner}
          </p>
        )}
        {(company.firstMetAt || company.lastMetAt) && (
          <p className="label-eyebrow">
            {company.firstMetAt && (
              <>
                First met <DateTime value={company.firstMetAt} relative />
              </>
            )}
            {company.firstMetAt && company.lastMetAt && " · "}
            {company.lastMetAt && (
              <>
                last recorded interaction{" "}
                <DateTime value={company.lastMetAt} relative />
              </>
            )}
          </p>
        )}
        <div className="pt-2">
          <GenerateBriefButton
            companyId={company.id}
            companyName={company.name}
          />
        </div>
      </div>

      {/* Decision memory — accent-bordered highlight */}
      {company.decision && company.decisionReason && (
        <div className="border-l-2 border-accent pl-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="label-eyebrow">Decision memory</span>
            <DecisionBadge decision={company.decision} />
          </div>
          <p className="text-[15px] leading-relaxed">
            {company.decisionReason}
          </p>
        </div>
      )}

      {/* Narrative fields */}
      <Section label="Overview">
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <Field label="Problem" value={company.problem} />
          <Field label="Solution" value={company.solution} />
          <Field label="Market" value={company.market} />
          <Field label="Business model" value={company.businessModel} />
          <Field label="Traction" value={company.traction} />
          <Field label="Competition" value={company.competition} />
        </div>
      </Section>

      <p className="text-sm text-muted-foreground">
        Missing profile fields indicate that no value was recorded here; they do
        not establish that the information is absent from every source document.
      </p>

      {/* Founders */}
      {company.founders.length > 0 && (
        <Section label="Founders">
          <ul className="space-y-3">
            {company.founders.map((f, i) => (
              <li key={i} className="text-[15px]">
                <span className="font-medium">{f.name}</span>
                {f.role ? ` — ${f.role}` : ""}
                {f.background && (
                  <span className="mt-0.5 block text-muted-foreground">
                    {f.background}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Assessment */}
      {(company.strengths.length > 0 ||
        company.risks.length > 0 ||
        company.concerns.length > 0) && (
        <Section label="Assessment">
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            <BulletList
              label="Strengths"
              items={company.strengths}
              tone="success"
            />
            <BulletList label="Risks" items={company.risks} tone="danger" />
            <BulletList
              label="Concerns"
              items={company.concerns}
              tone="warning"
            />
          </div>
        </Section>
      )}

      {company.documents.length === 0 && (
        <Section label="Source documents">
          <p className="text-muted-foreground">
            No source documents are linked to this company.
          </p>
          <Link
            href="/upload"
            className="text-link inline-flex min-h-11 items-center"
          >
            Add a document to memory
          </Link>
        </Section>
      )}

      {/* Per-document memory */}
      {company.documents.length > 0 && (
        <Section label="What each document suggests">
          {company.documents.length > 1 && (
            <p className="-mt-2 mb-5 text-[14px] text-muted-foreground">
              The fields above combine everything across these{" "}
              {company.documents.length} documents. Below is what each one
              contributed on its own.
            </p>
          )}
          <div className="space-y-3">
            {company.documents.map((d) => (
              <DocumentCard key={d.id} doc={d} companyId={company.id} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  companyId,
}: {
  doc: CompanyDocument;
  companyId: string;
}) {
  const intel = doc.intelligence;
  return (
    <div className="border border-border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <FileText
          className="h-4 w-4 shrink-0 text-muted-foreground"
          strokeWidth={1.5}
        />
        <Link
          href={`/companies/${companyId}/documents/${doc.id}`}
          className="text-link min-w-0 [overflow-wrap:anywhere] text-sm font-medium"
        >
          {doc.filename}
        </Link>
        {doc.docType && <Chip>{formatDocType(doc.docType)}</Chip>}
        {intel?.decision && <DecisionBadge decision={intel.decision} />}
        <span className="ml-auto text-xs text-muted-foreground">
          Uploaded <DateTime value={doc.createdAt} relative />
        </span>
      </div>

      {intel ? (
        <div className="mt-4 space-y-3">
          {intel.oneLiner && (
            <p className="text-[14px] text-muted-foreground">
              {intel.oneLiner}
            </p>
          )}
          {intel.decision && intel.decisionReason && (
            <p className="text-[14px]">
              <span className="font-medium">
                Why {intel.decision.toLowerCase()}:{" "}
              </span>
              {intel.decisionReason}
            </p>
          )}
          {(intel.strengths?.length ||
            intel.risks?.length ||
            intel.concerns?.length) && (
            <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
              <BulletList
                label="Strengths"
                items={intel.strengths}
                tone="success"
              />
              <BulletList label="Risks" items={intel.risks} tone="danger" />
              <BulletList
                label="Concerns"
                items={intel.concerns}
                tone="warning"
              />
            </div>
          )}
          {intel.traction && (
            <p className="text-[14px]">
              <span className="font-medium">Traction: </span>
              {intel.traction}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">
          This document has no individual extraction summary. Open its retained
          source text to review the evidence directly.
        </p>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8">
      <h2 className="label-eyebrow mb-5">{label}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="label-eyebrow mb-1.5">{label}</p>
      <p
        className={`text-[15px] leading-relaxed [overflow-wrap:anywhere] ${value ? "" : "text-muted-foreground"}`}
      >
        {value || "Not recorded in this company profile."}
      </p>
    </div>
  );
}

function formatDocType(docType: string): string {
  return docType.replace(/_/g, " ");
}
