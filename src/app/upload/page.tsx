/**
 * Upload page (Feature 1).
 * Drag/drop pitch decks, memos, founder notes -> POST /api/upload -> ingestion
 * pipeline extracts structured intelligence and indexes the document for search.
 */

import { PageHeader } from "@/components/layout/PageHeader";
import { Dropzone } from "@/components/upload/Dropzone";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Ingest"
        title="Upload documents"
        description="Pitch decks, investment memos, founder notes. Every upload becomes searchable memory — the AI extracts the company, decision, strengths, and risks automatically."
      />
      <Dropzone />
    </div>
  );
}
