/** Fictional corpus only. Providers here return scripted generations, never network calls. */
import { readFileSync } from "node:fs";
import { corpusFingerprint } from "../../scripts/lib/memory-live-safety";
import type { MemoryCompany, MemoryDocument, MemoryEvidence, MemoryRepository } from "../../src/lib/ai/memory-contract";
import type { MemoryChatDependencies, MemoryChatRequest } from "../../src/lib/ai/chat";
import type { GeneratedMemoryAnswer } from "../../src/lib/ai/memory-citations";
import { chunkText } from "../../src/lib/ingest/chunk";

const info = [
  ["cloud", "CloudBrain AI", "AI Infrastructure", null, "cloudbrain-ai-deck.md", "pitch_deck", "2025-08-14"],
  ["code", "CodeFlow AI", "Developer Tools", "Passed", "codeflow-ai-memo.md", "memo", "2025-09-03"],
  ["flow", "FlowAI", "SaaS", "Tracking", "flowai-notes.txt", "notes", "2025-10-11"],
  ["ledger", "LedgerLite", "Fintech", "Invested", "ledgerlite-memo.md", "memo", "2025-07-22"],
  ["vault", "VaultGuard", "Cybersecurity", null, "vaultguard-deck.md", "pitch_deck", "2025-11-05"],
] as const;

export const fixtureCompanies: MemoryCompany[] = info.map(([id, name, sector, decision, , , met]) => ({
  id, name, sector, decision, decisionReason: null,
  firstMetAt: `${met}T00:00:00.000Z`, lastMetAt: `${met}T00:00:00.000Z`, updatedAt: "2026-11-24T00:00:00.000Z",
}));
export const fixtureDocuments: MemoryDocument[] = info.map(([id, name, , , file, type]) => {
  const rawText = readFileSync(new URL(`../../data/demo/${file}`, import.meta.url), "utf8");
  return {
    id: `${id}-doc`, companyId: id, companyName: name, filename: file, docType: type,
    rawText, uploadedAt: "2026-11-24T00:00:00.000Z",
    chunks: chunkText(rawText).map((content, ordinal) => ({ id: `${id}-chunk-${ordinal}`, ordinal, content })),
  };
});
export const fixtureCorpusFingerprint = corpusFingerprint(fixtureDocuments);

export function fixtureRepository(companies = fixtureCompanies, documents = fixtureDocuments): MemoryRepository {
  const filter = (filters: Parameters<MemoryRepository["list"]>[0]) => companies.filter((company) =>
    (!filters.sector || company.sector?.toLowerCase() === filters.sector.toLowerCase()) &&
    (!filters.decision || company.decision === filters.decision) &&
    (!filters.metAfter || !!company.lastMetAt && company.lastMetAt >= filters.metAfter) &&
    (!filters.metBefore || !!company.lastMetAt && company.lastMetAt <= filters.metBefore));
  return {
    catalog: async () => structuredClone(companies),
    list: async (filters) => structuredClone(filter(filters)),
    count: async (filters) => filter(filters).length,
    documents: async (ids) => structuredClone(documents.filter((doc) => !!doc.companyId && ids.includes(doc.companyId))),
  };
}

export interface FixtureClaim {
  kind?: "fact" | "interpretation" | "suggestion" | "unknown";
  text: string;
  companyId?: string;
  quote?: string;
  extraSupports?: {companyId: string; quote: string}[];
}
export function scriptedAnswer(claims: FixtureClaim[], evidence: MemoryEvidence[]): GeneratedMemoryAnswer {
  return { blocks: claims.map((claim) => {
    const item = claim.quote ? evidence.find((source) =>
      (!claim.companyId || source.companyId === claim.companyId) && source.text.includes(claim.quote!)) : undefined;
    if (claim.quote && !item) throw new Error(`Required fixture evidence absent: ${claim.companyId}: ${claim.quote}`);
    return {
      kind: claim.kind ?? "fact", text: claim.text,
      supports: [
        ...(item ? [{ evidenceId: item.id, quote: claim.quote! }] : []),
        ...(claim.extraSupports ?? []).map((extra) => {
          const source = evidence.find((candidate) => candidate.companyId === extra.companyId && candidate.text.includes(extra.quote));
          if (!source) throw new Error("Required extra supporting excerpt absent");
          return { evidenceId: source.id, quote: extra.quote };
        }),
      ],
    };
  }) };
}
export function evidenceFromPrompt(prompt: string): MemoryEvidence[] {
  const input = JSON.parse(prompt);
  return (input.evidence as MemoryEvidence[]).map((source) => {
    if (typeof source.text === "string") return source;
    const passages = (input.passages as { evidenceId: string; start: number; text: string }[])
      .filter((passage) => passage.evidenceId === source.id).sort((a, b) => a.start - b.start);
    return { ...source, text: passages.map((passage) => passage.text).join("") };
  });
}
export function fixtureDependencies(claims: FixtureClaim[], options: {
  companies?: MemoryCompany[]; documents?: MemoryDocument[];
  onEvidence?: (evidence: MemoryEvidence[]) => void;
} = {}): Partial<MemoryChatDependencies> {
  return {
    repository: fixtureRepository(options.companies, options.documents),
    embed: async () => [1, 0, 0],
    search: async () => [],
    generate: async (prompt) => {
      const evidence = evidenceFromPrompt(prompt);
      options.onEvidence?.(evidence);
      return {
        text: JSON.stringify(scriptedAnswer(claims, evidence)), configuredModel: "fixture-provider",
        returnedModel: "fixture-provider-v1", finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
      };
    },
  };
}

const baseline = JSON.parse(readFileSync(new URL("../../docs/evaluations/memory-chat-baseline-2026-11-24.json", import.meta.url), "utf8"));
interface BaselineCase {
  id: string; question: string; expected?: string[];
  sourceBasedReview: { facts: string; coverage?: string; evidence?: string; taskFit?: string };
}
export const baselineCases: BaselineCase[] = [...baseline.baselineResults, ...baseline.diagnosticControls];
export const followupRequest: MemoryChatRequest = {
  message: "Who founded it, and what would make us lean in?",
  history: [{ role: "user", content: "Prepare me for a follow-up meeting with FlowAI." }],
};

const decision: FixtureClaim = { companyId: "code", text: "CodeFlow AI was Passed; its founding team was excellent.", quote: "**PASS.** The team is excellent" };
const codeConcerns: FixtureClaim = { companyId: "code", text: "The memo flags weak team adoption, distribution disadvantage, and a thin moat.", quote: fixtureDocuments.find((doc) => doc.companyId === "code")!.rawText.split("## Risks & concerns\n")[1].split("\n## Decision")[0].trim() };
const founders: FixtureClaim = { companyId: "flow", text: "Grace Lin is CEO and Raj Patel is CTO.", quote: "- Grace Lin, CEO. Ex-product manager at a big workflow/automation company. Sharp on GTM, very fast.\n- Raj Patel, CTO. Solid engineer, built the v1 mostly solo." };
const conditions: FixtureClaim[] = [
  { companyId: "flow", text: "Move upmarket to teams with proper pricing and NRR above 110%.", quote: "Move upmarket to teams with proper pricing and show net revenue retention > 110%." },
  { companyId: "flow", text: "Improve month-3 retention materially; no numerical month-3 target is recorded.", quote: "Demonstrate month-3 retention improving materially." },
  { companyId: "flow", text: "Establish reliability and observability so automations are trustworthy.", quote: "A reliability/observability story so automations are trustworthy." },
];
export const baselineClaims: Record<string, FixtureClaim[]> = {
  decision_reason: [decision, codeConcerns],
  exact_metrics: [{ companyId: "ledger", text: "LedgerLite recorded $1.8M ARR, 134% net revenue retention, and 22 platform customers in July 2025.", quote: "- $1.8M ARR, growing 18% month-over-month for the last 6 months.\n- 22 platform customers, including two that each contribute >$200k ARR.\n- Net revenue retention of 134%." }],
  complete_inventory: [],
  missing_facts: [{ kind: "unknown", text: "FlowAI's cash runway and monthly burn rate are not recorded in the available notes." }],
  unknown_company: [],
  false_premise: [decision, codeConcerns],
  paid_vs_pilot: [{ companyId: "cloud", text: "CloudBrain AI had three free design partners and $0 committed ARR. Target ACV and the fundraise were not achieved revenue.", quote: "- 3 design partners (a regional bank, a healthcare SaaS company, a logistics firm).\n- $0 in committed ARR yet — all design partners are on free pilots." }],
  revenue_comparison: [
    { companyId: "ledger", text: "LedgerLite: $1.8M ARR, July 2025.", quote: "$1.8M ARR, growing 18% month-over-month" },
    { companyId: "code", text: "CodeFlow AI: $11k MRR, September 2025.", quote: "$11k MRR from a $15/mo Pro tier" },
    { companyId: "flow", text: "FlowAI: approximately $9k MRR, October 2025.", quote: "~$9k MRR, mostly $29-49/mo prosumer plans." },
  ],
  unsupported_decisions: [{ kind: "unknown", text: "The original CloudBrain AI and VaultGuard decks do not record a firm investment decision." }],
  flowai_meeting: [
    { companyId: "flow", text: "FlowAI: Tracking in October 2025.", quote: "Status: TRACKING (not investing now, stay close)" },
    { companyId: "flow", text: "Approximately $9k MRR on $29-49/month prosumer pricing.", quote: "~$9k MRR, mostly $29-49/mo prosumer plans." },
    { companyId: "flow", text: "Month-2 retention was around 55%.", quote: "RETENTION: month-2 retention around 55%." },
    ...conditions,
    { kind: "unknown", text: "No later retention update is retained; current real-world performance is unknown." },
    { kind: "suggestion", text: "What has changed in team pricing, NRR, retention, and reliability?" },
  ],
  flowai_followup: [founders, ...conditions],
  temporal_update: [
    { companyId: "flow", text: "October 2025 month-2 retention was around 55%.", quote: "RETENTION: month-2 retention around 55%." },
    { kind: "unknown", text: "No later retention source is retained. This does not establish whether performance changed in the real world." },
  ],
  retention_comparison: [
    decision,
    { companyId: "code", text: "CodeFlow AI: approximately 12% monthly paid logo churn, September 2025.", quote: "**logo churn is ~12% monthly** on the paid tier." },
    { companyId: "flow", text: "FlowAI: Tracking, with approximately 55% month-2 retention and pricing/reliability concerns, October 2025.", quote: fixtureDocuments.find((doc) => doc.companyId === "flow")!.rawText.split("Concerns (why we\'re tracking, not investing):\n")[1].split("\nWhat would make us lean in:")[0].trim() },
    { kind: "interpretation", companyId: "flow", text: "Monthly paid logo churn and month-2 cohort retention measure different things and are not interchangeable.", quote: "RETENTION: month-2 retention around 55%.", extraSupports: [{companyId: "code", quote: "**logo churn is ~12% monthly** on the paid tier."}] },
  ],
  followup_explicit_control: [founders, ...conditions],
  flowai_full_source_control: [founders, ...conditions],
};
