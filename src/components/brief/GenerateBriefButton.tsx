"use client";

/**
 * "Generate brief" action for the company detail page (Feature 4). POSTs the
 * companyId to /api/brief, then renders the partner-ready memo in an overlay
 * sheet with a print/save action. The deck is read from memory — nothing is
 * persisted by generating a brief.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Loader2, Printer, X } from "lucide-react";
import { BriefReport } from "@/components/brief/BriefReport";
import type { InvestmentBrief } from "@/lib/types";

export function GenerateBriefButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<InvestmentBrief | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal target (document.body) is only available on the client.
  useEffect(() => setMounted(true), []);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Brief generation failed.");
      setBrief(data.brief);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Brief generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={brief ? () => setOpen(true) : generate}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 border border-border px-4 text-[13px] font-medium transition-colors hover:border-foreground/40 hover:bg-secondary disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              Writing brief…
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
              {brief ? "View investment brief" : "Generate investment brief"}
            </>
          )}
        </button>
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>

      {open &&
        brief &&
        mounted &&
        createPortal(
          <BriefOverlay
            brief={brief}
            companyName={companyName}
            onClose={() => setOpen(false)}
            onRegenerate={generate}
            regenerating={loading}
          />,
          document.body
        )}
    </>
  );
}

function BriefOverlay({
  brief,
  companyName,
  onClose,
  onRegenerate,
  regenerating,
}: {
  brief: InvestmentBrief;
  companyName: string;
  onClose: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <div
      className="brief-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="brief-sheet my-auto w-full max-w-3xl border border-border bg-background p-8 shadow-sm sm:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet header */}
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1.5">
            <p className="label-eyebrow">Investment brief</p>
            <h1 className="font-serif text-3xl font-normal tracking-tight">
              {companyName}
            </h1>
          </div>
          <div className="brief-no-print flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={1.5} /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <BriefReport brief={brief} />

        <p className="mt-12 border-t border-border pt-4 text-[12px] leading-relaxed text-muted-foreground">
          Generated from the firm&apos;s memory. AI-assisted draft — the
          recommendation is intentionally hedged; the investment decision stays
          with the partners.
        </p>
      </div>
    </div>
  );
}
