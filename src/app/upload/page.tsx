import type { Metadata } from "next";
/**
 * Upload page (Feature 1).
 * Drag/drop pitch decks, memos, founder notes -> POST /api/upload -> ingestion
 * pipeline extracts structured intelligence and indexes the document for search.
 */

import { PageHeader } from "@/components/layout/PageHeader";
import { Dropzone } from "@/components/upload/Dropzone";

export const metadata: Metadata = { title: "Upload documents" };

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Ingest"
        title="Upload documents"
        description="Pitch decks, investment memos, founder notes. Every upload becomes searchable memory — the AI extracts the company, decision, strengths, and risks automatically."
      />
      <aside
        className="border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground"
        aria-label="Before you upload"
      >
        <p className="font-medium text-foreground">Before you upload</p>
        <p>
          Documents are stored in this application’s workspace and used for
          extraction and search. This version has no account-isolated workspaces
          or in-app deletion. Use fictional or non-confidential material; other
          visitors can access stored company records.
        </p>
      </aside>
      <Dropzone />
    </div>
  );
}
