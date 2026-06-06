"use client";

/**
 * Drag-and-drop upload control (Feature 1). Validates against config UPLOAD,
 * POSTs files to /api/upload, and surfaces per-file processing/loading/error
 * state plus the extracted-company result.
 *
 * TODO(impl): drag/drop handlers, file validation, upload + progress UI.
 */
export function Dropzone() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      Drag &amp; drop pitch decks, memos, or notes here.
      {/* TODO: interactive dropzone */}
    </div>
  );
}
