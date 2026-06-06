/**
 * Feature 4 — investment brief generation.
 *
 * Given a company already in memory (plus its similar past deals), generate a
 * clean, partner-ready memo with the standard sections:
 *   Overview, Problem, Solution, Market, Founder Signals, Traction, Strengths,
 *   Risks, Similar Past Deals, Questions for Founder, Recommendation.
 *
 * The Recommendation must be hedged ("Needs partner review" / "Interesting
 * signal" / "Needs more diligence") — never a final invest/pass call.
 *
 * TODO(impl): assemble Company + similar deals -> Claude with BRIEF_SYSTEM.
 */

import type { InvestmentBrief } from "@/lib/types";

export async function generateBrief(
  _companyId: string
): Promise<InvestmentBrief> {
  throw new Error("generateBrief: not implemented yet");
}
