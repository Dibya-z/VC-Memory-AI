/**
 * Company detail page. Shows the full extracted intelligence for one startup,
 * its source documents, and a button to generate an investment brief.
 * Data from GET /api/companies/[id].
 *
 * TODO(impl): render structured fields, decision memory, documents, and a
 * "Generate brief" action -> /api/brief.
 */
export default function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Company</h1>
      <p className="text-sm text-muted-foreground">
        Detail view for company <code>{params.id}</code>.
      </p>
      {/* TODO: structured intelligence + documents + <InvestmentBrief /> trigger */}
    </div>
  );
}
