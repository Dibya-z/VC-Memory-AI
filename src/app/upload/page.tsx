/**
 * Upload page (Feature 1).
 * Drag/drop pitch decks, memos, founder notes -> POST /api/upload -> ingestion
 * pipeline extracts structured intelligence and indexes the document for search.
 *
 * TODO(impl): render <Dropzone />, show per-file processing/loading state and
 * the extracted-company result card on success.
 */
export default function UploadPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Upload documents</h1>
      <p className="text-sm text-muted-foreground">
        Pitch decks, investment memos, founder notes. Every upload becomes
        searchable memory.
      </p>
      {/* TODO: <Dropzone /> */}
    </div>
  );
}
