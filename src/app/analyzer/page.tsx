/**
 * Deal Analyzer page (Feature 3 — analyze a new deck + compare to past deals).
 */

import { PageHeader } from "@/components/layout/PageHeader";
import { DealAnalyzer } from "@/components/analyzer/DealAnalyzer";

export default function AnalyzerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Analysis"
        title="Deal analyzer"
        description="Upload a new deck. We analyze it and surface every comparable deal you've already evaluated — and what you concluded then."
      />
      <DealAnalyzer />
    </div>
  );
}
