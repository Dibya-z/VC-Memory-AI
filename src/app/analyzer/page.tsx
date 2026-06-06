/**
 * Deal Analyzer page (Feature 3 — analyze a new deck + compare to past deals).
 * Not yet wired — editorial header + placeholder for now.
 */

import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

export default function AnalyzerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Analysis"
        title="Deal analyzer"
        description="Upload a new deck. We analyze it and surface every comparable deal you've already evaluated — and what you concluded then."
      />
      <Placeholder
        icon={Sparkles}
        title="Deal analyzer is coming soon"
        note="Drop in a new pitch deck and get an analysis plus the most similar past deals from memory, with the firm's prior reasoning."
      />
    </div>
  );
}
