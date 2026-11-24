import type { Metadata } from "next";
/**
 * Deal Analyzer page (Feature 3 — analyze a new deck + compare to past deals).
 */

import { PageHeader } from "@/components/layout/PageHeader";
import { DealAnalyzer } from "@/components/analyzer/DealAnalyzer";

export const metadata: Metadata = { title: "Deal analyzer" };

export default function AnalyzerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Analysis"
        title="Deal analyzer"
        description="Analyze a new deck and compare it with the closest retrieved companies in memory, including their recorded decisions."
      />
      <DealAnalyzer />
    </div>
  );
}
