import { z } from "zod";
import type { Citation } from "@/lib/types";
import type { MemoryEvidence } from "./memory-contract";

const supportSchema = z.object({
  evidenceId: z.string().min(1).max(300),
  quote: z.string().trim().min(8).max(1200),
}).strict();

export const generatedMemoryAnswerSchema = z.object({
  blocks: z.array(z.object({
    kind: z.enum(["fact", "interpretation", "suggestion", "unknown"]),
    text: z.string().trim().min(1).max(1800),
    supports: z.array(supportSchema).max(6),
  }).strict()).min(1).max(16),
}).strict();

export type GeneratedMemoryAnswer = z.infer<typeof generatedMemoryAnswerSchema>;

const LABELS = {
  fact: "Recorded fact",
  interpretation: "Interpretation",
  suggestion: "Suggested diligence question",
  unknown: "Not recorded / uncertain",
} as const;

/**
 * Enforces provenance and output structure, not semantic entailment. A quote may
 * be authentic yet fail to support a paraphrase; evaluation must assess that too.
 * Retrieved text cannot create references, titles, links, HTML, or output roles.
 */
export function validateMemoryAnswer(
  raw: unknown,
  evidence: MemoryEvidence[],
): { answer: string; citations: Citation[] } {
  const parsed = generatedMemoryAnswerSchema.parse(raw);
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const citations = new Map<string, Citation>();
  const paragraphs: string[] = [];
  for (const block of parsed.blocks) {
    if ((block.kind === "fact" || block.kind === "interpretation") && !block.supports.length) {
      throw new Error("A recorded claim requires supporting evidence.");
    }
    if (/(?:\b(?:and|or|including|such as|with|the)\b\s*[.!?]?|[:,;–—-]|(?:^|\n)\s*(?:[-*]|\d+[.)]))\s*$/i.test(block.text)) {
      throw new Error("Generated text ends in an unfinished clause or list.");
    }
    // All display references are issued below. The model cannot invent its own.
    if (/[\[\]【】]|<\s*\/?[a-z][^>]*>|https?:\/\/|\b(?:page|pages|line|lines)\s*\d/i.test(block.text)) {
      throw new Error("Generated text contains an unverified reference or markup.");
    }
    for (const filename of block.text.match(/\b[\w.-]+\.(?:pdf|md|txt)\b/gi) ?? []) {
      if (!evidence.some((item) => item.documentName === filename)) {
        throw new Error("Generated text names an unknown document.");
      }
    }
    // Source titles are display metadata, not model-authored facts. In
    // particular, a deck excerpt cannot be relabeled as a follow-up memo.
    const supportedDocuments = block.supports.map((support) => byId.get(support.evidenceId))
      .filter((item): item is MemoryEvidence => item?.kind === "document");
    for (const [description, docType] of [[/\bmemos?\b/i, "memo"], [/\bdecks?\b/i, "pitch_deck"], [/\bnotes\b/i, "notes"]] as const) {
      if (description.test(block.text) && block.supports.length &&
        !supportedDocuments.some((item) => item.documentType === docType)) {
        throw new Error("Generated text describes a source type that was not supplied as support.");
      }
    }
    if (/\b(?:follow-up|later|subsequent|updated)\s+(?:memo|deck|document)\b/i.test(block.text) &&
      !supportedDocuments.some((item) => /follow.?up|later|subsequent|updated/i.test(item.documentName ?? ""))) {
      throw new Error("Generated text introduces an unverified later source.");
    }
    const refs = new Set<string>();
    for (const support of block.supports) {
      const item = byId.get(support.evidenceId);
      if (!item) throw new Error("Generated answer referenced evidence that was not supplied.");
      const localStart = item.text.indexOf(support.quote);
      if (localStart < 0) throw new Error("Generated quote does not match retained source text.");
      // A source can contain an attempted prompt injection. Such text is retained
      // for provenance but cannot authorize an output instruction or a firm fact.
      if (/\b(?:ignore|disregard|override|replace)\b[^\n]{0,100}\b(?:instructions?|prompts?|rules?|system|developer)\b|\b(?:system|assistant|developer)\s*:/i.test(support.quote)) {
        throw new Error("Instruction-like source text cannot support an answer claim.");
      }
      refs.add(item.id);
      const key = `${item.id}:${support.quote}`;
      if (!citations.has(key)) citations.set(key, {
        companyId: item.companyId, companyName: item.companyName,
        snippet: support.quote,
        evidenceId: item.id, documentId: item.documentId,
        documentName: item.documentName, documentType: item.documentType,
        chunkId: item.chunkId, sourceDate: item.sourceDate, uploadedAt: item.uploadedAt,
        quote: support.quote,
        location: { start: item.start + localStart, end: item.start + localStart + support.quote.length },
      });
    }
    paragraphs.push(`${LABELS[block.kind]}: ${block.text}${refs.size ? ` ${[...refs].map((id) => `[${id}]`).join(" ")}` : ""}`);
  }
  return { answer: paragraphs.join("\n\n"), citations: [...citations.values()] };
}
