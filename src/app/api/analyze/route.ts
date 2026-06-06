import { NextResponse } from "next/server";
import { UPLOAD } from "@/config/constants";
import { extractText } from "@/lib/ingest/extract-text";
import { analyzeNewDeal } from "@/lib/ai/analyze";

/**
 * POST /api/analyze — Feature 3 deal analysis + memory comparison.
 * multipart/form-data with either a `file` (.pdf/.txt/.md) or pasted `text`.
 * The deck is NOT persisted to memory — it's analyzed in place and compared
 * against the firm's existing companies.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const text = form.get("text");

  let documentText: string;
  let filename: string | undefined;

  if (file instanceof File && file.size > 0) {
    const err = validateFile(file);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractText({
        buffer,
        filename: file.name,
        mime: file.type,
      });
      documentText = extracted.text;
      filename = file.name;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Couldn't read this file." },
        { status: 400 }
      );
    }
  } else if (typeof text === "string" && text.trim().length >= 30) {
    documentText = text.trim();
  } else {
    return NextResponse.json(
      {
        error:
          "Provide a .pdf/.txt/.md file, or paste at least a few sentences of deck text.",
      },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeNewDeal(documentText);
    return NextResponse.json({ analysis, filename });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed." },
      { status: 500 }
    );
  }
}

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!UPLOAD.ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `Unsupported file type. Accepted: ${UPLOAD.ACCEPTED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > UPLOAD.MAX_SIZE_BYTES) {
    const mb = (UPLOAD.MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return `File is too large (max ${mb} MB).`;
  }
  return null;
}
