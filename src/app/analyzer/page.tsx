/**
 * Deal Analyzer page (Feature 3).
 * Upload a NEW startup deck -> analyze it AND compare against similar past deals
 * from memory. Posts to /api/analyze. Renders the analysis plus the matched
 * historical companies (what we concluded then, why it's relevant now).
 *
 * TODO(impl): upload control + <AnalysisReport /> + <SimilarDeals />.
 */
export default function AnalyzerPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Deal analyzer</h1>
      <p className="text-sm text-muted-foreground">
        Upload a new deck. We analyze it and surface every comparable deal you
        already evaluated.
      </p>
      {/* TODO: upload -> <AnalysisReport /> + <SimilarDeals /> */}
    </div>
  );
}
