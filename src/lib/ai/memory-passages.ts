import type { MemoryEvidence } from "./memory-contract";

/** A server-owned, exact span of one retained evidence item. Offsets are absolute. */
export interface MemoryPassage {
  id: string;
  evidenceId: string;
  text: string;
  start: number;
  end: number;
}

export const MEMORY_PASSAGE_CHARS = 900;

/**
 * Partition retained source text without normalization or omitted separators.
 * Paragraph/line boundaries keep short related facts together; an unusually
 * long paragraph falls back to whitespace and then an exact character span.
 * IDs are stable for the same ordered evidence within a request.
 */
export function buildMemoryPassages(evidence: MemoryEvidence[]): MemoryPassage[] {
  const passages: MemoryPassage[] = [];
  for (const item of evidence) {
    if (!item.text.trim()) continue;
    let start = 0;
    while (start < item.text.length) {
      let end = Math.min(start + MEMORY_PASSAGE_CHARS, item.text.length);
      const paragraphBreak = /\r?\n[ \t]*\r?\n/.exec(item.text.slice(start, end));
      if (paragraphBreak) {
        end = start + paragraphBreak.index + paragraphBreak[0].length;
      } else if (end < item.text.length) {
        const minimum = start + Math.floor(MEMORY_PASSAGE_CHARS / 4);
        const line = item.text.lastIndexOf("\n", end - 1);
        if (line >= minimum) end = line + 1;
        else {
          const whitespace = [...item.text.slice(start, end).matchAll(/\s+/g)].at(-1);
          if (whitespace && start + whitespace.index! >= minimum) {
            end = start + whitespace.index! + whitespace[0].length;
          }
        }
      }
      // Retained offsets use UTF-16, but a displayed passage must not end in
      // half of a supplementary Unicode character.
      if (end < item.text.length && /[\uD800-\uDBFF]/.test(item.text[end - 1]) && /[\uDC00-\uDFFF]/.test(item.text[end])) end--;
      passages.push({
        id: `P${passages.length + 1}`,
        evidenceId: item.id,
        text: item.text.slice(start, end),
        start: item.start + start,
        end: item.start + end,
      });
      start = end;
    }
  }
  return passages;
}
