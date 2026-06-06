/**
 * Company Memory page (Feature: Company Memory).
 * Lists every startup the firm has stored, with filters for sector, decision,
 * and stage. Data from GET /api/companies (with query params).
 *
 * TODO(impl): <CompanyFilters /> + <CompanyCard /> grid (or <CompanyTable />).
 */
export default function CompaniesPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Company memory</h1>
      <p className="text-sm text-muted-foreground">
        Every startup you&apos;ve reviewed — filter by sector, decision, or stage.
      </p>
      {/* TODO: <CompanyFilters /> + <CompanyCard /> grid */}
    </div>
  );
}
