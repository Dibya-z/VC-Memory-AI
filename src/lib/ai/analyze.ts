/**
 * Feature 3 — new deal analysis + memory comparison.
 *
 * Pipeline:
 *   1. Extract the new startup's intelligence (lib/ai/extract).
 *   2. Embed it and retrieve the most similar PAST companies from memory.
 *   3. Ask Claude to produce: summary, positive signals, risks, founder
 *      questions, and an explicit comparison to the similar past deals
 *      (what we concluded then, and why it's relevant now).
 *
 * Recommendation language stays hedged ("Interesting signal — needs partner
 * review"); the AI never decides.
 *
 * TODO(impl): combine extractIntelligence + vector similarity + ANALYSIS_SYSTEM.
 */

import type { DealAnalysis } from "@/lib/types";

export async function analyzeNewDeal(
  _documentText: string
): Promise<DealAnalysis> {
  throw new Error("analyzeNewDeal: not implemented yet");
}
