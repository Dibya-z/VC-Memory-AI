import { NextResponse } from "next/server";

/**
 * POST /api/upload — Feature 1 ingestion.
 * Accepts multipart/form-data with one or more files (.pdf/.txt/.md). Validates
 * type/size, runs lib/ingest/pipeline.ingestDocument() for each, returns the
 * created company + extracted intelligence per file.
 *
 * Error handling to implement: empty document, wrong file type, oversized file,
 * extraction/AI failure — each with a clear client-facing message.
 *
 * TODO(impl): parse formData, validate against config UPLOAD, call pipeline.
 */
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
