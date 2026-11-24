import { z } from "zod";
import type { Citation } from "@/lib/types";
import type { MemoryEvidence } from "./memory-contract";
import type { MemoryPassage } from "./memory-passages";

// Exact-quote support stays accepted for older callers and replay fixtures.
// New generations select server-created passage IDs and never author quotes.
const supportSchema = z.union([
  z.object({ passageId: z.string().min(1).max(40) }).strict(),
  z.object({
    evidenceId: z.string().min(1).max(300),
    quote: z.string().trim().min(8).max(1200),
  }).strict(),
]);

export const generatedMemoryAnswerSchema = z.object({
  blocks: z.array(z.object({
    kind: z.enum(["fact", "interpretation", "suggestion", "unknown"]),
    text: z.string().trim().min(1).max(1800),
    supports: z.array(supportSchema).max(6),
  }).strict()).min(1).max(16),
}).strict();

export type GeneratedMemoryAnswer = z.infer<typeof generatedMemoryAnswerSchema>;

export type MemoryAnswerValidationCode =
  | "schema" | "missing_support" | "invalid_evidence_id" | "quote_mismatch"
  | "unsupported_source_assertion" | "invalid_reference" | "incomplete_text" | "instruction_source";

/** Safe categories/paths are suitable for bounded corrective feedback. */
export class MemoryAnswerValidationError extends Error {
  constructor(
    readonly code: MemoryAnswerValidationCode,
    message: string,
    readonly path: (string | number)[] = [],
  ) {
    super(message);
    this.name = "MemoryAnswerValidationError";
  }
}

function instructionLike(text: string): boolean {
  return /\b(?:ignore|disregard|override|replace)\b[^\n]{0,100}\b(?:instructions?|prompts?|rules?|system|developer)\b|\b(?:system|assistant|developer)\s*:/i.test(text);
}

const LABELS = {
  fact: "Recorded fact",
  interpretation: "Interpretation",
  suggestion: "Suggested diligence question",
  unknown: "Not recorded / uncertain",
} as const;

/**
 * Negation belongs to one source mention and its clause, not to the entire
 * block. An absence followed by "but a later memo says ..." must not authorize
 * that later memo. Keep this grammar conservative; this is not entailment.
 */
function isSourceAbsence(text: string, start: number, end: number): boolean {
  // "not yet received" is one negative predicate, not a new clause.
  const boundary = /[.!?;:\n]|\b(?:but|however|although|whereas|nevertheless|and)\b/i;
  const before = text.slice(0, start).split(boundary).pop()!.trim()
    .replace(/[’‘]/g, "'");
  const after = text.slice(end).split(boundary)[0].trim()
    .replace(/[’‘]/g, "'");
  const descriptors = "(?:(?:a|an|any|the|new|later|subsequent|updated|follow[- ]?up)\\s+)*";
  const negativeDeterminer = new RegExp(`(?:^|\\s)(?:no|without|missing|unavailable)\\s+${descriptors}$`, "i");
  const negativeAction = new RegExp(
    `\\b(?:(?:have|has|had|do|does|did|can|could)\\s+not|haven't|hasn't|hadn't|don't|doesn't|didn't|can't|couldn't)\\s+(?:yet\\s+)?(?:find|found|record|recorded|retain|retained|receive|received|capture|captured|store|stored|locate|located|include|contain|have)\\s+${descriptors}$`, "i"
  );
  const negativeExistential = new RegExp(
    `\\bthere\\s+(?:(?:is|are|was|were)\\s+not|isn't|aren't|wasn't|weren't)\\s+${descriptors}$`, "i"
  );
  const presence = "(?:available|retained|recorded|present|stored|captured|uploaded|found|provided|supplied|received|exists?)";
  const positivePresence = new RegExp(`^(?:(?:is|are|was|were|has been|have been)\\s+)?(?:currently\\s+)?${presence}\\b`, "i");
  const negativePresence = new RegExp(
    `^(?:(?:is|are|was|were|has|have|had)\\s+not|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't)\\s+(?:been\\s+)?(?:currently\\s+)?${presence}\\b|^(?:is|are|was|were)\\s+(?:currently\\s+)?(?:unavailable|missing|absent)\\b`, "i"
  );
  const contextOnly = /^(?:(?:in|within|for|about|on)\b[^,]*)?$/i.test(after);
  if (negativeDeterminer.test(`${before} `)) {
    // Do not read double negatives as an absence assertion.
    return !negativePresence.test(after) && (contextOnly || positivePresence.test(after));
  }
  if (negativeAction.test(`${before} `) || negativeExistential.test(`${before} `)) return contextOnly;
  return negativePresence.test(after);
}

/** A proposed request for a future source does not assert an existing source. */
function isSourceRequest(text: string, start: number, kind: string): boolean {
  if (kind !== "suggestion") return false;
  const before = text.slice(0, start)
    .split(/[.!?;:\n]|\b(?:but|however|although|whereas|nevertheless|and)\b/i).pop()!.trim();
  const request = /^(?:(?:(?:could|can|would|will)\s+(?:you|we|they|the\s+(?:founders?|team))\s+)|(?:please\s+))?(?:share|provide|send|show|bring|prepare|supply|create|produce|request|obtain|ask\s+(?:(?:the|our|their)\s+)?(?:founders?|team|company)\s+(?:for|to\s+(?:share|provide|send|show|bring|prepare|supply|create|produce)))\s+(?:(?:us|me)\s+)?(?:(?:a|an|any|the|new|later|subsequent|updated|follow[- ]?up)\s+)*$/i;
  return request.test(`${before} `);
}

/**
 * Enforces provenance and output structure, not semantic entailment. A quote may
 * be authentic yet fail to support a paraphrase; evaluation must assess that too.
 * Retrieved text cannot create references, titles, links, HTML, or output roles.
 */
export function validateMemoryAnswer(
  raw: unknown,
  evidence: MemoryEvidence[],
  passages: MemoryPassage[] = [],
): { answer: string; citations: Citation[] } {
  const validation = generatedMemoryAnswerSchema.safeParse(raw);
  if (!validation.success) {
    throw new MemoryAnswerValidationError("schema", "Generated answer does not match the required schema.", validation.error.issues[0]?.path ?? []);
  }
  const parsed = validation.data;
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const byPassageId = new Map(passages.map((item) => [item.id, item]));
  if (byPassageId.size !== passages.length) {
    throw new MemoryAnswerValidationError("invalid_evidence_id", "Passage identifiers must be unique.");
  }
  const citations = new Map<string, Citation>();
  const paragraphs: string[] = [];
  for (const [blockIndex, block] of parsed.blocks.entries()) {
    const path: (string | number)[] = ["blocks", blockIndex];
    const fail = (code: MemoryAnswerValidationCode, message: string, suffix: (string | number)[] = []): never => {
      throw new MemoryAnswerValidationError(code, message, [...path, ...suffix]);
    };
    if ((block.kind === "fact" || block.kind === "interpretation") && !block.supports.length) {
      fail("missing_support", "A recorded claim requires supporting evidence.", ["supports"]);
    }
    if (/(?:\b(?:and|or|including|such as|with|the)\b\s*[.!?]?|[:,;–—-]|(?:^|\n)\s*(?:[-*]|\d+[.)]))\s*$/i.test(block.text)) {
      fail("incomplete_text", "Generated text ends in an unfinished clause or list.", ["text"]);
    }
    // All display references are issued below. The model cannot invent its own.
    if (/[\[\]【】]|<\s*\/?[a-z][^>]*>|https?:\/\/|\b(?:page|pages|line|lines)\s*\d/i.test(block.text)) {
      fail("invalid_reference", "Generated text contains an unverified reference or markup.", ["text"]);
    }
    for (const filename of block.text.match(/\b[\w.-]+\.(?:pdf|md|txt)\b/gi) ?? []) {
      if (!evidence.some((item) => item.documentName === filename)) {
        fail("unsupported_source_assertion", "Generated text names an unknown document.", ["text"]);
      }
    }
    const resolved = block.supports.map((support, supportIndex) => {
      const supportPath = ["supports", supportIndex];
      if ("passageId" in support) {
        const passage = byPassageId.get(support.passageId);
        if (!passage) return fail("invalid_evidence_id", "Generated answer referenced a passage that was not supplied.", supportPath);
        const item = byId.get(passage.evidenceId);
        if (!item) return fail("invalid_evidence_id", "Generated answer referenced evidence that was not supplied.", supportPath);
        const localStart = passage.start - item.start;
        const localEnd = passage.end - item.start;
        if (!Number.isInteger(localStart) || !Number.isInteger(localEnd) || localStart < 0 || localEnd <= localStart ||
          localEnd > item.text.length || item.text.slice(localStart, localEnd) !== passage.text) {
          return fail("quote_mismatch", "Passage does not match retained source text.", supportPath);
        }
        if (!passage.text.trim()) return fail("missing_support", "A recorded claim requires non-empty supporting evidence.", supportPath);
        return { item, quote: passage.text, localStart, referenceId: passage.id };
      }
      const item = byId.get(support.evidenceId);
      if (!item) return fail("invalid_evidence_id", "Generated answer referenced evidence that was not supplied.", supportPath);
      const localStart = item.text.indexOf(support.quote);
      if (localStart < 0) return fail("quote_mismatch", "Generated quote does not match retained source text.", supportPath);
      return { item, quote: support.quote, localStart, referenceId: item.id };
    });
    // Source titles are display metadata, not model-authored facts. In
    // particular, a deck excerpt cannot be relabeled as a follow-up memo.
    const supportedDocuments = resolved.map((support) => support.item)
      .filter((item) => item.kind === "document");
    for (const [description, docType] of [[/\bmemos?\b/gi, "memo"], [/\bdecks?\b/gi, "pitch_deck"], [/\bnotes\b/gi, "notes"]] as const) {
      const asserted = [...block.text.matchAll(description)].some((match) =>
        !isSourceAbsence(block.text, match.index!, match.index! + match[0].length) &&
        !isSourceRequest(block.text, match.index!, block.kind));
      if (asserted && block.supports.length &&
        !supportedDocuments.some((item) => item.documentType === docType)) {
        fail("unsupported_source_assertion", "Generated text describes a source type that was not supplied as support.", ["text"]);
      }
    }
    const assertedLaterSource = [...block.text.matchAll(/\b(?:follow[- ]?up|later|subsequent|updated)\s+(?:memos?|decks?|documents?|notes)\b/gi)]
      .some((match) => !isSourceAbsence(block.text, match.index!, match.index! + match[0].length) &&
        !isSourceRequest(block.text, match.index!, block.kind));
    if (assertedLaterSource &&
      !supportedDocuments.some((item) => /follow.?up|later|subsequent|updated/i.test(item.documentName ?? ""))) {
      fail("unsupported_source_assertion", "Generated text introduces an unverified later source.", ["text"]);
    }
    const refs = new Set<string>();
    for (const [supportIndex, support] of resolved.entries()) {
      const { item, quote, localStart, referenceId } = support;
      // A source can contain an attempted prompt injection. Such text is retained
      // for provenance but cannot authorize an output instruction or a firm fact.
      if (instructionLike(quote)) {
        fail("instruction_source", "Instruction-like source text cannot support an answer claim.", ["supports", supportIndex]);
      }
      refs.add(referenceId);
      const key = `${referenceId}:${quote}`;
      if (!citations.has(key)) citations.set(key, {
        companyId: item.companyId, companyName: item.companyName,
        snippet: quote,
        evidenceId: referenceId, documentId: item.documentId,
        documentName: item.documentName, documentType: item.documentType,
        chunkId: item.chunkId, sourceDate: item.sourceDate, uploadedAt: item.uploadedAt,
        quote,
        location: { start: item.start + localStart, end: item.start + localStart + quote.length },
      });
    }
    paragraphs.push(`${LABELS[block.kind]}: ${block.text}${refs.size ? ` ${[...refs].map((id) => `[${id}]`).join(" ")}` : ""}`);
  }
  return { answer: paragraphs.join("\n\n"), citations: [...citations.values()] };
}
