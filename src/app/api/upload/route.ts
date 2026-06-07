import { NextResponse } from "next/server";
import { UPLOAD } from "@/config/constants";
import { ingestDocument } from "@/lib/ingest/pipeline";
import type { UploadResult } from "@/lib/types";

/**
 * POST /api/upload — Feature 1 ingestion.
 * Accepts multipart/form-data with one or more files (field name "files"),
 * each .pdf/.txt/.md. Validates type/size, runs the ingestion pipeline per
 * file, and returns the created company + extracted intelligence per file.
 *
 * Errors are reported per file so one bad upload never fails the whole batch.
 */

// pdf-parse + Prisma need the Node runtime (not edge).
export const runtime = "nodejs";
// Ingestion does extract + LLM + multiple embeddings (Vercel default is 10s).
export const maxDuration = 60;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with file uploads." },
      { status: 400 }
    );
  }

  const files = [
    ...form.getAll("files"),
    ...form.getAll("file"),
  ].filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files provided. Attach at least one .pdf, .txt, or .md file." },
      { status: 400 }
    );
  }

  const results: UploadResult[] = [];

  for (const file of files) {
    const validationError = validateFile(file);
    if (validationError) {
      results.push({ filename: file.name, ok: false, error: validationError });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { documentId, companyId, intelligence } = await ingestDocument({
        buffer,
        filename: file.name,
        mime: file.type,
      });
      results.push({
        filename: file.name,
        ok: true,
        documentId,
        companyId,
        intelligence,
      });
    } catch (err) {
      results.push({
        filename: file.name,
        ok: false,
        error: err instanceof Error ? err.message : "Failed to process this file.",
      });
    }
  }

  return NextResponse.json({ results });
}

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okExt = UPLOAD.ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!okExt) {
    return `Unsupported file type. Accepted: ${UPLOAD.ACCEPTED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > UPLOAD.MAX_SIZE_BYTES) {
    const mb = (UPLOAD.MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return `File is too large (max ${mb} MB).`;
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  return null;
}
