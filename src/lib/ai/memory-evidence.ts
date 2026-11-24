import type { RetrievedChunk } from "@/lib/types";
import type { VectorSearchOptions } from "@/lib/vector/store";
import type {
  EvidenceSelection, MemoryCompany, MemoryDocument, MemoryEvidence,
  MemoryRepository, QueryPlan,
} from "./memory-contract";

/** Character budget, not a provider-specific token estimate. Leave room for instructions/output. */
export const MEMORY_CONTEXT_CHARS = 24_000;
const MAX_SEMANTIC_CHUNKS = 12;

export interface MemoryEvidenceDependencies {
  repository: MemoryRepository;
  embed: (question: string) => Promise<number[]>;
  search: (embedding: number[], options?: VectorSearchOptions) => Promise<RetrievedChunk[]>;
}

/** Source dates are retained at their original precision. Upload time is separate metadata. */
export function recordedSourceDate(text: string): string | null {
  const line = text.split(/\r?\n/).slice(0, 30)
    .map((s) => s.replace(/\*\*/g, "").trim())
    .find((s) => /^(?:Date|Met|Meeting date|Source date):\s*\S/i.test(s));
  return line?.replace(/^[^:]+:\s*/, "").slice(0, 120) ?? null;
}

const STOP = new Set(("what which who why how when where we our us the a an is are was were " +
  "be been have has had do does did can could would should and or of in on at to for from " +
  "with about any all every company companies startup startups memory recorded record firm " +
  "before after please tell me explain compare comparison know seen ai only give it its their they").split(" "));

function terms(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? [])
    .map((word) => word.replace(/(?:ies)$/, "y").replace(/s$/, ""))
    .filter((word) => word.length > 2 && !STOP.has(word)));
}

/** Lexical corroboration is a conservative relevance guard, not a cosine threshold or reranker. */
export function corroboratesQuestion(question: string, source: string): boolean {
  const query = terms(question);
  const sourceTerms = terms(source);
  const groups = [
    ["coding", "code", "programming", "programmer", "copilot"],
    ["assistant", "pair-programmer", "copilot"],
    ["revenue", "arr", "mrr"],
    ["retention", "churn"],
    ["founder", "team"],
  ];
  return [...query].some((word) => sourceTerms.has(word) || groups.some((group) =>
    group.includes(word) && group.some((synonym) => sourceTerms.has(synonym))));
}

function documentEvidence(doc: MemoryDocument, start: number, end: number): MemoryEvidence {
  const text = doc.rawText.slice(start, end);
  const exactChunk = doc.chunks.find((chunk) => chunk.content === text);
  return {
    id: `doc:${doc.id}:${start}-${end}`,
    kind: "document", companyId: doc.companyId, companyName: doc.companyName,
    documentId: doc.id, documentName: doc.filename, documentType: doc.docType,
    chunkId: exactChunk?.id ?? null, text, start, end,
    sourceDate: recordedSourceDate(doc.rawText), uploadedAt: doc.uploadedAt,
  };
}

export function companyRecordEvidence(company: MemoryCompany): MemoryEvidence {
  const text = [
    `Current company record: ${company.name}`,
    `Recorded decision: ${company.decision ?? "not recorded"}`,
    // A missing extracted field is not evidence that the documents lack reasons.
    ...(company.decisionReason?.trim() ? [`Recorded decision reason: ${company.decisionReason}`] : []),
    `Sector: ${company.sector ?? "not recorded"}`,
    `Last recorded interaction: ${company.lastMetAt ?? "not recorded"}`,
    `Record updated at: ${company.updatedAt} (record metadata, not a source date)`,
  ].join("\n");
  return {
    id: `company:${company.id}`, kind: "company_record",
    companyId: company.id, companyName: company.name,
    documentId: null, documentName: null, documentType: null, chunkId: null,
    text, start: 0, end: text.length, sourceDate: null, uploadedAt: null,
  };
}

/** Select query-relevant sections anywhere in a large source, including its tail. */
function sourceWindows(doc: MemoryDocument, question: string, budget: number): MemoryEvidence[] {
  if (budget < 200 || !doc.rawText.trim()) return [];
  if (doc.rawText.length <= budget) return [documentEvidence(doc, 0, doc.rawText.length)];

  const sections: { start: number; end: number; score: number }[] = [];
  const query = terms(question);
  const boundaries = [0];
  for (const match of doc.rawText.matchAll(/\n(?=#{1,3}\s|[A-Z][^\n]{0,90}:\s*\n)/g)) {
    const offset = (match.index ?? 0) + 1;
    if (offset > boundaries[boundaries.length - 1]) boundaries.push(offset);
  }
  boundaries.push(doc.rawText.length);
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i], end = boundaries[i + 1];
    const sectionTerms = terms(doc.rawText.slice(start, end));
    if (end - start <= budget) {
      sections.push({ start, end, score: [...query].filter((t) => sectionTerms.has(t)).length });
    }
  }
  // Fixed-size overlapping windows also cover long unstructured/plain-text documents.
  const windowSize = Math.min(2200, budget);
  for (let start = 0; start < doc.rawText.length; start += Math.max(200, windowSize - 300)) {
    const end = Math.min(start + windowSize, doc.rawText.length);
    const windowTerms = terms(doc.rawText.slice(start, end));
    sections.push({ start, end, score: [...query].filter((t) => windowTerms.has(t)).length });
  }
  sections.sort((a, b) => b.score - a.score || a.start - b.start);
  const selected: { start: number; end: number }[] = [];
  let remaining = budget;
  for (const section of sections) {
    if (remaining < 200) break;
    if (selected.some((item) => item.start < section.end && section.start < item.end)) continue;
    const end = Math.min(section.end, section.start + remaining);
    selected.push({ start: section.start, end });
    remaining -= end - section.start;
  }
  return selected.sort((a, b) => a.start - b.start)
    .map(({ start, end }) => documentEvidence(doc, start, end));
}

export async function selectMemoryEvidence(
  plan: QueryPlan,
  companies: MemoryCompany[],
  deps: MemoryEvidenceDependencies,
): Promise<EvidenceSelection> {
  if (plan.unknownCompany || plan.intent === "clarification") {
    return { evidence: [], sufficient: false, reason: "No resolved company or question.", omittedDocuments: 0 };
  }

  let companyIds = [...plan.companyIds];
  let semanticDocumentIds: Set<string> | undefined;
  if (!companyIds.length) {
    const embedding = await deps.embed(plan.standaloneQuestion);
    const candidates = await deps.search(embedding, { topK: MAX_SEMANTIC_CHUNKS });
    const relevant = candidates.filter((candidate) => candidate.companyId &&
      Number.isFinite(candidate.score) && corroboratesQuestion(plan.standaloneQuestion, candidate.content));
    companyIds = [...new Set(relevant.map((candidate) => candidate.companyId!))];
    semanticDocumentIds = new Set(relevant.map((candidate) => candidate.documentId));
    if (!companyIds.length) return {
      evidence: [], sufficient: false,
      reason: "Nearest neighbors did not corroborate the question's subject; no relevant evidence was selected.",
      omittedDocuments: 0,
    };
  }

  const allowedIds = new Set(companyIds);
  const requestedTypes = new Set<string>();
  if (/\bdecks?\b/i.test(plan.standaloneQuestion)) requestedTypes.add("pitch_deck");
  if (/\bmemos?\b/i.test(plan.standaloneQuestion)) requestedTypes.add("memo");
  if (/\bnotes\b/i.test(plan.standaloneQuestion)) requestedTypes.add("notes");
  const documents = (await deps.repository.documents(companyIds))
    .filter((doc) => doc.companyId && allowedIds.has(doc.companyId) &&
      (!semanticDocumentIds || semanticDocumentIds.has(doc.id)) &&
      (!requestedTypes.size || (doc.docType !== null && requestedTypes.has(doc.docType))))
    .sort((a, b) => a.id.localeCompare(b.id));
  const sourceSpecific = requestedTypes.size > 0 || /\b(?:original|sources?|documents?)\b/i.test(plan.standaloneQuestion);
  const originalUncertain = /\boriginal\b/i.test(plan.standaloneQuestion) &&
    companyIds.some((id) => documents.filter((doc) => doc.companyId === id).length > 1);
  const records = sourceSpecific ? [] : companies.filter((c) => allowedIds.has(c.id)).map(companyRecordEvidence);
  const evidence: MemoryEvidence[] = [];
  let remaining = MEMORY_CONTEXT_CHARS;
  for (const record of records) {
    if (record.text.length > remaining) break;
    evidence.push(record);
    remaining -= record.text.length;
  }

  const perCompany = Math.floor(remaining / companyIds.length);
  let omittedDocuments = 0;
  let partial = false;
  for (const companyId of companyIds) {
    const own = documents.filter((doc) => doc.companyId === companyId && doc.rawText.trim());
    let ownBudget = perCompany;
    for (let i = 0; i < own.length; i++) {
      // Reserve room for each source so an early long source cannot swallow later sources.
      const docBudget = Math.floor(ownBudget / (own.length - i));
      const selected = sourceWindows(own[i], plan.standaloneQuestion, docBudget);
      if (!selected.length) omittedDocuments++;
      const chars = selected.reduce((sum, item) => sum + item.text.length, 0);
      if (chars < own[i].rawText.length) partial = true;
      ownBudget -= chars;
      evidence.push(...selected);
    }
  }

  const covered = companyIds.every((id) => evidence.some((item) => item.companyId === id));
  const hasDocuments = evidence.some((item) => item.kind === "document");
  return {
    evidence,
    sufficient: covered && (hasDocuments || records.length > 0),
    reason: !covered ? "At least one requested company has no retained evidence. Ask for the missing source."
      : partial || omittedDocuments ? "Relevant evidence selected within budget; some sources are partial or omitted. Absence claims require qualification."
      : originalUncertain ? "Multiple matching sources exist. Original source identity is not established by upload timestamps; qualify uncertainty rather than choosing an original source."
      : hasDocuments ? "Complete available short sources included for each requested company. Missing facts can be identified without inventing values."
      : "Only current company records are available; document facts and historical reasons may be missing.",
    omittedDocuments,
  };
}
