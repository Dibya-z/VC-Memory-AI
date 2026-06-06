/**
 * Text extraction from uploaded files.
 *   - .txt / .md : decode the buffer directly.
 *   - .pdf       : `pdf-parse` for the text layer. If a deck is image-only and
 *                  yields little/no text, fall back to Claude's native PDF
 *                  document blocks (base64) to read it.
 *
 * Throws on empty/garbage extraction so the upload route can surface a clear
 * "couldn't read this document" error rather than ingesting nothing.
 *
 * TODO(impl): pdf-parse + empty-result guard + optional Claude PDF fallback.
 */

export interface ExtractedText {
  text: string;
  fileType: "pdf" | "txt" | "md";
}

export async function extractText(
  _file: { buffer: Buffer; filename: string; mime: string }
): Promise<ExtractedText> {
  throw new Error("extractText: not implemented yet");
}
