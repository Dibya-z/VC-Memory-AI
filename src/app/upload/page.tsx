/**
 * Upload page (Feature 1).
 * Drag/drop pitch decks, memos, founder notes -> POST /api/upload -> ingestion
 * pipeline extracts structured intelligence and indexes the document for search.
 */

import { Dropzone } from "@/components/upload/Dropzone";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Upload documents</h1>
        <p className="text-sm text-muted-foreground">
          Pitch decks, investment memos, founder notes. Every upload becomes
          searchable memory — the AI extracts the company, decision, strengths,
          and risks automatically.
        </p>
      </div>

      <Dropzone />
    </div>
  );
}
