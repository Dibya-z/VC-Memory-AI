/**
 * Text extraction from uploaded files.
 *   - .txt / .md : decode the buffer directly.
 *   - .pdf       : `pdf-parse` reads the text layer.
 *
 * If a PDF yields little/no text (image-only / scanned deck), we throw a clear
 * error rather than ingesting an empty document — Groq/Llama has no native PDF
 * vision input, so the honest answer is "give me a text-based file". The upload
 * route surfaces this message to the user.
 */

export interface ExtractedText {
  text: string;
  fileType: "pdf" | "txt" | "md";
}

/** Below this many non-whitespace chars we treat extraction as a failure. */
const MIN_USEFUL_CHARS = 20;

function fileTypeOf(filename: string): ExtractedText["fileType"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  throw new Error(
    `Unsupported file type: ${filename}. Upload a .pdf, .txt, or .md file.`
  );
}

export async function extractText(file: {
  buffer: Buffer;
  filename: string;
  mime: string;
}): Promise<ExtractedText> {
  const fileType = fileTypeOf(file.filename);

  let text: string;
  if (fileType === "pdf") {
    // pdf-parse is CommonJS; import the lib entry directly to skip its
    // debug-mode test harness, and keep it out of the client bundle
    // (see serverExternalPackages in next.config.mjs).
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(file.buffer);
    text = parsed.text ?? "";
  } else {
    text = file.buffer.toString("utf-8");
  }

  text = normalizeWhitespace(text);

  if (text.replace(/\s/g, "").length < MIN_USEFUL_CHARS) {
    throw new Error(
      fileType === "pdf"
        ? "Couldn't read any text from this PDF — it may be image-only or scanned. " +
          "Please upload a text-based PDF, or paste the content as a .txt/.md file."
        : "This file appears to be empty. Please upload a document with content."
    );
  }

  return { text, fileType };
}

/** Collapse excessive blank lines / trailing spaces while preserving paragraphs. */
function normalizeWhitespace(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n") // trailing spaces
    .replace(/\n{3,}/g, "\n\n") // collapse big gaps to a single blank line
    .trim();
}
