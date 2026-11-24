"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Printer, X } from "lucide-react";
import { BriefReport } from "@/components/brief/BriefReport";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DateTime } from "@/components/ui/DateTime";
import { requestJson } from "@/lib/client/request";
import { useHydrated } from "@/lib/client/use-hydrated";
import type { InvestmentBrief } from "@/lib/types";

const MAX_SAVED_BRIEF_CHARS = 250_000;
const REMOVE_SAVED_BRIEF_ERROR =
  "Could not remove saved copy. Clear this site’s browser data to remove it.";

function isBrief(value: unknown): value is InvestmentBrief {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    [
      "company",
      "overview",
      "problem",
      "solution",
      "market",
      "founderSignals",
      "traction",
      "recommendation",
    ].every((key) => typeof b[key] === "string") &&
    ["strengths", "risks", "questionsForFounder"].every(
      (key) =>
        Array.isArray(b[key]) &&
        (b[key] as unknown[]).every((item) => typeof item === "string"),
    ) &&
    Array.isArray(b.similarPastDeals) &&
    b.similarPastDeals.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.companyId === "string" &&
        typeof item.name === "string" &&
        Number.isFinite(item.similarity) &&
        ["sector", "decision", "reason"].every(
          (key) => item[key] === undefined || typeof item[key] === "string",
        ),
    )
  );
}

function readSavedBrief(key: string): {
  brief: InvestmentBrief | null;
  generatedAt: string | null;
  error: string | null;
} {
  const empty = { brief: null, generatedAt: null, error: null };
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return empty;
    if (raw.length > MAX_SAVED_BRIEF_CHARS)
      return { ...empty, error: "The saved brief is too large to restore." };
    const saved = JSON.parse(raw);
    if (!saved || !isBrief(saved.brief))
      return { ...empty, error: "The saved brief could not be restored." };
    return {
      brief: saved.brief,
      generatedAt:
        typeof saved.generatedAt === "string" &&
        Number.isFinite(new Date(saved.generatedAt).getTime())
          ? saved.generatedAt
          : null,
      error: null,
    };
  } catch {
    return { ...empty, error: "This browser could not restore a saved brief." };
  }
}

/** Briefs remain transient unless the user explicitly remembers one in this tab. */
export function GenerateBriefButton(props: {
  companyId: string;
  companyName: string;
}) {
  const hydrated = useHydrated();
  return hydrated ? (
    <BriefAction key={props.companyId} {...props} />
  ) : (
    <Button variant="secondary" disabled>
      Generate investment brief
    </Button>
  );
}

function BriefAction({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const storageKey = `vc-memory:brief:v1:${companyId}`;
  const [initial] = useState(() => readSavedBrief(storageKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    initial.brief ? "Restored the brief remembered in this browser tab." : null,
  );
  const [brief, setBrief] = useState<InvestmentBrief | null>(initial.brief);
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    initial.generatedAt,
  );
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(Boolean(initial.brief));
  const storageReady = true;
  const [storageError, setStorageError] = useState<string | null>(
    initial.error,
  );
  const controllerRef = useRef<AbortController | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!storageReady) return;
    const save = () => {
      let storageOperation: "save" | "remove" =
        remember && brief ? "save" : "remove";
      try {
        if (remember && brief) {
          const serialized = JSON.stringify({ brief, generatedAt });
          if (serialized.length > MAX_SAVED_BRIEF_CHARS) {
            storageOperation = "remove";
            sessionStorage.removeItem(storageKey);
            setStorageError(
              "This brief is too large to remember in this tab. Print or save a PDF to retain it.",
            );
            return;
          }
          sessionStorage.setItem(storageKey, serialized);
        } else sessionStorage.removeItem(storageKey);
        setStorageError(null);
      } catch {
        setStorageError(
          storageOperation === "remove"
            ? REMOVE_SAVED_BRIEF_ERROR
            : "This browser could not save the latest brief for this tab. A previous saved copy may remain. You can clear it below or print the current brief.",
        );
      }
    };
    const timer = window.setTimeout(save, 0);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [remember, brief, generatedAt, storageReady, storageKey]);

  function clearSavedCopy() {
    try {
      // Remove first: never claim that sensitive data was cleared if storage fails.
      sessionStorage.removeItem(storageKey);
      setRemember(false);
      setStorageError(null);
      setNotice(
        "Saved copy cleared. The current brief stays open until you leave this page.",
      );
    } catch {
      setStorageError(REMOVE_SAVED_BRIEF_ERROR);
      setNotice(null);
    }
  }

  function changeRemember(checked: boolean) {
    if (!checked) {
      clearSavedCopy();
      return;
    }
    setNotice(null);
    setRemember(true);
  }

  function cancel() {
    controllerRef.current?.abort();
    setNotice("Stopped waiting for the brief. You can retry when ready.");
  }

  function close() {
    controllerRef.current?.abort();
    setLoading(false);
    setOpen(false);
  }

  async function generate() {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const data = await requestJson<{ brief: unknown }>("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!isBrief(data.brief))
        throw new Error(
          "The generated brief could not be displayed. Please retry.",
        );
      setBrief(data.brief);
      setGeneratedAt(new Date().toISOString());
      setOpen(true);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Brief generation failed. Please retry.",
        );
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <>
      <div className="no-print flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            ref={triggerRef}
            variant="secondary"
            onClick={brief ? () => setOpen(true) : generate}
            loading={loading}
          >
            {!loading && (
              <FileText
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={1.5}
              />
            )}
            {loading
              ? "Writing brief…"
              : brief
                ? "View investment brief"
                : "Generate investment brief"}
          </Button>
          {loading && !open && (
            <Button variant="ghost" onClick={cancel}>
              Cancel generation
            </Button>
          )}
        </div>
        {loading && !open && (
          <p role="status" className="text-sm text-muted-foreground">
            Generating a brief from company memory…
          </p>
        )}
        {error && !open && (
          <Alert variant="error">
            {error}{" "}
            <button className="text-link" onClick={generate}>
              Retry brief generation
            </button>
          </Alert>
        )}
        {notice && !open && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </div>

      <Dialog
        open={open && Boolean(brief)}
        onClose={close}
        title={`Investment brief: ${companyName}`}
        className="brief-overlay"
        panelClassName="brief-sheet"
        initialFocusRef={closeRef}
        returnFocusRef={triggerRef}
      >
        {brief && (
          <>
            <div className="mb-8 space-y-4 border-b border-border pb-5">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <p className="label-eyebrow">Investment brief</p>
                  <h2 className="font-serif text-3xl font-normal tracking-tight [overflow-wrap:anywhere]">
                    {companyName}
                  </h2>
                  {generatedAt && (
                    <p className="text-sm text-muted-foreground">
                      <DateTime value={generatedAt} label="Generated" /> · Draft
                      snapshot
                    </p>
                  )}
                </div>
                <Button
                  ref={closeRef}
                  variant="ghost"
                  size="icon"
                  aria-label="Close investment brief"
                  onClick={close}
                  className="brief-no-print -mr-2 -mt-2"
                >
                  <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
                </Button>
              </div>
              <div className="brief-no-print flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={generate}
                  loading={loading}
                >
                  {loading ? "Regenerating…" : "Regenerate"}
                </Button>
                {loading && (
                  <Button variant="ghost" onClick={cancel}>
                    Cancel generation
                  </Button>
                )}
                <Button variant="ghost" onClick={() => window.print()}>
                  <Printer
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={1.5}
                  />
                  Print / save PDF
                </Button>
              </div>
            </div>
            {error && (
              <Alert variant="error" className="brief-no-print mb-6">
                Regeneration failed: {error} Showing the previous brief.{" "}
                <button className="text-link" onClick={generate}>
                  Retry regeneration
                </button>
              </Alert>
            )}
            {notice && (
              <p
                role="status"
                className="brief-no-print mb-5 text-sm text-muted-foreground"
              >
                {notice}
              </p>
            )}
            {loading && (
              <p
                role="status"
                className="brief-no-print mb-5 text-sm text-muted-foreground"
              >
                Regenerating. The previous brief remains below until the
                replacement is ready.
              </p>
            )}
            <div aria-busy={loading}>
              <BriefReport brief={brief} />
            </div>
            <div className="brief-no-print mt-8 space-y-2 border-t border-border pt-4 text-sm">
              <label className="flex items-start gap-3 py-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => changeRemember(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  Remember this brief in this browser tab. Its content will be
                  stored in this browser session until you clear it.
                </span>
              </label>
              {remember && (
                <Button variant="ghost" size="sm" onClick={clearSavedCopy}>
                  Clear saved copy
                </Button>
              )}
              {storageError && <Alert variant="error">{storageError}</Alert>}
            </div>
            <p className="mt-8 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              Generated from the firm&apos;s memory. This AI-assisted draft
              reflects the sources available when generated; partners make the
              investment decision.
            </p>
          </>
        )}
      </Dialog>
    </>
  );
}
