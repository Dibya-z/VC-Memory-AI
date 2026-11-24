import type { ChatResult } from "../../src/lib/ai/chat";
import { baselineCases, baselineClaims, fixtureDocuments } from "../../tests/fixtures/memory";

/** Explicit fixture oracle, separate from runtime routing and generation. No LLM judge. */
const gold: Record<string, RegExp[]> = {
  decision_reason: [/Passed/i, /founders|team/i, /adoption/i, /distribution/i, /moat/i],
  exact_metrics: [/1\.8M\s*ARR/i, /134\s*%/, /22\s*platform/i],
  complete_inventory: [/CloudBrain AI: not recorded/i, /CodeFlow AI: Passed/i, /FlowAI: Tracking/i, /LedgerLite: Invested/i, /VaultGuard: not recorded/i, /Total companies: 5/],
  missing_facts: [/runway/i, /burn/i, /not recorded|not captured/i],
  unknown_company: [/Orchid Robotics/i, /couldn't find|no .*record|not recorded/i],
  false_premise: [/Passed/i, /founders.*praised|team.*excellent/i, /adoption/i, /distribution/i, /moat/i],
  paid_vs_pilot: [/three|3/i, /free/i, /\$0.*(?:committed\s*)?ARR/i],
  revenue_comparison: [/LedgerLite.*\$1\.8M\s*ARR/i, /CodeFlow AI.*\$11k\s*MRR/i, /FlowAI.*(?:approximately|~|around).*\$9k\s*MRR/i],
  unsupported_decisions: [/CloudBrain AI/i, /VaultGuard/i, /not record|no .*decision/i],
  flowai_meeting: [/Tracking/i, /(?:approximately|~|around).*\$9k.*MRR/i, /55\s*%/, /pric/i, /reliab/i, /Suggested diligence question:/i],
  flowai_followup: [/Grace Lin/i, /Raj Patel/i, /upmarket|up.market|teams/i, /110\s*%/, /month.3/i, /reliab/i],
  temporal_update: [/55\s*%/, /no later|no .*update|not .*update/i],
  retention_comparison: [/Passed/i, /Tracking/i, /12\s*%.*monthly|monthly.*12\s*%/i, /55\s*%/, /month.2/i, /different|not interchangeable|not directly comparable/i],
};
gold.followup_explicit_control = gold.flowai_followup;
gold.flowai_full_source_control = gold.flowai_followup;

/** Assistant source review of the scripted fixture responses against committed public files. */
const sourceReviews: Record<string, string> = {
  decision_reason: "PASS/team excerpt and full Risks & concerns section support the correction and each principal reason.",
  exact_metrics: "One Traction excerpt contains all three values; July 2025 comes from the verified source Date heading.",
  complete_inventory: "All current fixture records are listed, including two null decisions; list/count bypass generation and retrieval.",
  missing_facts: "The complete sole FlowAI notes contain neither runway nor burn; the absence response returns no unrelated citation.",
  unknown_company: "Catalog lookup finds no Orchid Robotics record; no source or provider is used to infer its facts.",
  false_premise: "PASS and excellent-team source wording correct both premises; the retained risks support adoption, distribution and moat concerns.",
  paid_vs_pilot: "The Traction excerpt explicitly states three partners, free pilots and zero committed ARR; target ACV/fundraise remain targets.",
  revenue_comparison: "Separate company Traction excerpts preserve annual versus monthly units and FlowAI approximation; dates retain source precision.",
  unsupported_decisions: "Both complete original fixture decks were inspected: neither records a firm decision; no later memo is asserted.",
  flowai_meeting: "Status, Traction, Concerns and lean-in excerpts support the facts; missing updates are qualified and the final question is labeled suggested.",
  flowai_followup: "User antecedent resolves FlowAI; both founder lines and all three lean-in conditions appear in the complete notes. No numeric month-3 target is supplied.",
  temporal_update: "Only the October notes are retained; month-2 baseline is cited and real-world change is left unknown.",
  retention_comparison: "Each metric has its own source excerpt; the interpretation cites both measurement definitions and does not equate monthly churn with cohort retention.",
  followup_explicit_control: "Complete FlowAI notes include both founders and each lean-in condition, including the document tail missed by the old pipeline.",
  flowai_full_source_control: "This now traverses normal named-company source selection using a scripted provider; it is not a repeated live causal experiment.",
};

export function assessMemoryCase(id: string, result: ChatResult, mode: "fixture" | "live") {
  const expected = gold[id] ?? [];
  const missingChecks = expected.filter((pattern) => !pattern.test(result.answer)).map(String);
  const validStatus = result.status === (id === "unknown_company" ? "insufficient_evidence" : "complete");
  const documentCitations = result.citations.filter((citation) => citation.documentId);
  const quoteMatchesFixture = documentCitations.every((citation) => {
    const source = fixtureDocuments.find((doc) => doc.filename === citation.documentName);
    return !!source && !!citation.location && source.rawText.slice(citation.location.start, citation.location.end) === citation.quote;
  });
  const factual = (baselineClaims[id] ?? []).some((claim) => (claim.kind ?? "fact") === "fact");
  const citationsUseful = quoteMatchesFixture && (!factual || documentCitations.length > 0) &&
    (id !== "unknown_company" || result.citations.length === 0);
  return {
    correctness: { status: validStatus && missingChecks.length === 0 ? "pass" : "fail", missingChecks },
    completeness: { status: validStatus && missingChecks.length === 0 ? "pass" : "fail", checkedFields: expected.length },
    groundedness: { provenance: quoteMatchesFixture ? "pass" : "fail", semanticSupport: mode === "fixture" ? "assistant_source_review_of_scripted_answer" : "requires_source_based_human_review", sourceReview: mode === "fixture" ? sourceReviews[id] : "Review each paraphrase against its exact excerpts and the complete expected source; no automatic entailment score." },
    citationUsefulness: { status: citationsUseful ? "pass" : "fail", usedDocumentExcerpts: documentCitations.length },
    taskFit: { status: validStatus && result.answer.length < 7000 ? "pass" : "fail", statusReturned: result.status },
    caveat: mode === "fixture" ? "Scripted provider: verifies routing, source availability, provenance and response contracts; does not score model quality."
      : "Regex field checks and exact-source provenance are diagnostics, not semantic entailment or a general accuracy benchmark.",
  };
}
export function baselineComparison(id: string) {
  return baselineCases.find((scenario) => scenario.id === id)?.sourceBasedReview;
}
