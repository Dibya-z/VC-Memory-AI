/**
 * Splits document text into overlapping chunks for embedding/retrieval.
 * Defaults from config/constants RAG.{CHUNK_SIZE, CHUNK_OVERLAP}. Prefers to
 * break on paragraph/sentence boundaries so chunks stay coherent, then carries
 * a small overlap forward so context isn't lost across a cut.
 */

import { RAG } from "@/config/constants";

export function chunkText(
  text: string,
  opts: { size?: number; overlap?: number } = {}
): string[] {
  const size = opts.size ?? RAG.CHUNK_SIZE;
  const overlap = Math.min(opts.overlap ?? RAG.CHUNK_OVERLAP, Math.floor(size / 2));

  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    // If we're not at the very end, prefer a natural boundary near `end`
    // rather than slicing mid-sentence. Search backwards within the last
    // ~30% of the window for (in priority order) a paragraph break, a
    // sentence end, then any whitespace.
    if (end < clean.length) {
      const windowStart = start + Math.floor(size * 0.7);
      const boundary =
        lastIndexInRange(clean, "\n\n", windowStart, end) ??
        lastSentenceEnd(clean, windowStart, end) ??
        lastIndexInRange(clean, "\n", windowStart, end) ??
        lastIndexInRange(clean, " ", windowStart, end);
      if (boundary && boundary > start) end = boundary;
    }

    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/** Last index of `needle` within [from, to), or null. Returns the position
 *  just *after* the match so the boundary char stays with the current chunk. */
function lastIndexInRange(
  hay: string,
  needle: string,
  from: number,
  to: number
): number | null {
  const idx = hay.lastIndexOf(needle, to - needle.length);
  if (idx < from) return null;
  return idx + needle.length;
}

/** Last sentence terminator (. ! ?) followed by a space, within [from, to). */
function lastSentenceEnd(hay: string, from: number, to: number): number | null {
  for (let i = to - 1; i >= from; i--) {
    const c = hay[i];
    if ((c === "." || c === "!" || c === "?") && /\s/.test(hay[i + 1] ?? " ")) {
      return i + 1;
    }
  }
  return null;
}
