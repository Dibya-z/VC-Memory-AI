"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UploadCloud, ArrowRight, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD } from "@/config/constants";
import { SAMPLE_DECKS } from "@/config/sample-decks";
import { AnalysisReport } from "@/components/analyzer/AnalysisReport";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { validateDocumentFile } from "@/lib/client/files";
import { requestJson } from "@/lib/client/request";
import { useHydrated } from "@/lib/client/use-hydrated";
import {
  ANALYSIS_SESSION_KEY,
  ANALYSIS_SESSION_LIMIT,
  isDealAnalysis,
  parseAnalysisSession,
  type AnalysisSession,
} from "@/lib/client/analysis-session";
import type { DealAnalysis } from "@/lib/types";

type SourceMode = "file" | "text";
const REMOVE_STORAGE_ERROR =
  "Could not remove saved analysis. Clear this site’s browser data to remove it.";

function readSavedAnalysis(): { saved: AnalysisSession | null; error: string } {
  try {
    const raw = sessionStorage.getItem(ANALYSIS_SESSION_KEY);
    const saved = raw ? parseAnalysisSession(raw) : null;
    return {
      saved,
      error:
        raw && !saved
          ? "The saved analysis could not be restored. Clear this site’s browser data to remove it."
          : "",
    };
  } catch {
    return {
      saved: null,
      error:
        "This browser cannot restore saved analysis. Keep this page open to retain your work.",
    };
  }
}

export function DealAnalyzer() {
  const hydrated = useHydrated();
  return hydrated ? (
    <AnalyzerSession />
  ) : (
    <p role="status" className="text-sm text-muted-foreground">
      Loading analysis tools…
    </p>
  );
}

function AnalyzerSession() {
  const [initial] = useState(readSavedAnalysis);
  const [mode, setMode] = useState<SourceMode>(initial.saved?.mode ?? "file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState(initial.saved?.text ?? "");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    initial.saved ? "Your saved analysis was restored in this tab." : "",
  );
  const [analysis, setAnalysis] = useState<DealAnalysis | null>(
    initial.saved?.analysis ?? null,
  );
  const [analyzedName, setAnalyzedName] = useState(
    initial.saved?.analyzedName ?? "",
  );
  const [restoredFilename, setRestoredFilename] = useState(
    initial.saved?.filename ?? "",
  );
  const [keepInTab, setKeepInTab] = useState(Boolean(initial.saved));
  const storageReady = true;
  const [storageError, setStorageError] = useState(initial.error);
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const fieldId = useId();

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (!storageReady || !keepInTab) return;
    const save = () => {
      try {
        const saved: AnalysisSession = {
          version: 1,
          mode,
          text,
          filename: file?.name ?? restoredFilename,
          analyzedName,
          analysis,
        };
        const serialized = JSON.stringify(saved);
        if (
          text.length > 120_000 ||
          serialized.length > ANALYSIS_SESSION_LIMIT
        ) {
          try {
            sessionStorage.removeItem(ANALYSIS_SESSION_KEY);
          } catch {
            setStorageError(REMOVE_STORAGE_ERROR);
            return;
          }
          setStorageError(
            "This source or result is too large to keep in this tab. Keep this page open; the current analysis still works.",
          );
          return;
        }
        sessionStorage.setItem(ANALYSIS_SESSION_KEY, serialized);
        setStorageError("");
      } catch {
        setStorageError(
          "Your browser could not save this analysis. Keep this page open to retain your work.",
        );
      }
    };
    const timer = window.setTimeout(save, 0);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [
    storageReady,
    keepInTab,
    mode,
    text,
    file,
    restoredFilename,
    analyzedName,
    analysis,
  ]);
  useEffect(() => {
    if (analysis) resultRef.current?.focus();
  }, [analysis]);

  function changePersistence(enabled: boolean) {
    if (enabled) {
      setStorageError("");
      setKeepInTab(true);
      return;
    }
    try {
      sessionStorage.removeItem(ANALYSIS_SESSION_KEY);
      setKeepInTab(false);
      setStorageError("");
      setNotice("Saved analysis removed from this browser tab.");
    } catch {
      // Keep the checked state until removal is confirmed; never imply deletion.
      setStorageError(REMOVE_STORAGE_ERROR);
    }
  }

  function selectFile(selected: File | undefined) {
    if (!selected || requestRef.current) return;
    const problem = validateDocumentFile(selected);
    setError(problem);
    if (problem) {
      setFile(null);
      setRestoredFilename("");
      return;
    }
    setFile(selected);
    setRestoredFilename("");
    setNotice(selected.name + " selected.");
  }

  async function analyze(sample?: { text: string; label: string }) {
    if (requestRef.current) return;
    const source = sample
      ? {
          mode: "text" as const,
          text: sample.text,
          file: null,
          label: sample.label,
        }
      : {
          mode,
          text: text.trim(),
          file,
          label: mode === "file" ? (file?.name ?? "Document") : "Pasted deck",
        };
    const problem =
      source.mode === "file"
        ? source.file
          ? validateDocumentFile(source.file)
          : "Choose a deck before analyzing."
        : source.text.trim().length < 30
          ? "Paste at least 30 characters of deck or memo text."
          : null;
    if (problem) {
      setError(problem);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setError(null);
    setNotice(
      "Analyzing the selected source and retrieving comparable companies.",
    );
    setLoading(true);
    try {
      const body = new FormData();
      if (source.mode === "file" && source.file)
        body.append("file", source.file);
      else body.append("text", source.text.trim());
      const data = await requestJson<{
        analysis: DealAnalysis;
        filename?: string;
      }>("/api/analyze", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestRef.current !== controller)
        return;
      if (!isDealAnalysis(data.analysis))
        throw new Error(
          "The server returned an incomplete analysis. Your source is still available; retry analysis.",
        );
      setAnalyzedName(source.label);
      setAnalysis(data.analysis);
      setNotice("Analysis complete for " + source.label + ".");
    } catch (cause) {
      if (controller.signal.aborted || requestRef.current !== controller)
        return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Analysis failed. Your source is still available; try again.",
      );
      setNotice("");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  function cancel() {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setNotice("Analysis stopped. Your source is still available.");
  }

  function runSample(deck: (typeof SAMPLE_DECKS)[number]) {
    setMode("text");
    setText(deck.text);
    void analyze({ text: deck.text, label: deck.label + " (sample deck)" });
  }

  function returnToSource(clear: boolean) {
    setAnalysis(null);
    setError(null);
    setNotice(
      clear ? "Ready for another analysis." : "Your source is ready to edit.",
    );
    if (clear) {
      setFile(null);
      setText("");
      setMode("file");
      setAnalyzedName("");
      setRestoredFilename("");
    }
    requestAnimationFrame(() => sourceRef.current?.focus());
  }

  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice}
      </p>
      <div className="space-y-1 border-b border-border pb-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={keepInTab}
            disabled={!storageReady}
            onChange={(event) => changePersistence(event.target.checked)}
            className="accent-foreground"
          />
          Keep source text and result in this browser tab
        </label>
        <p className="text-sm text-muted-foreground">
          Optional browser storage survives refresh in this tab. Uncheck to
          remove saved data. File contents are never saved; reselect a file to
          analyze it again.
        </p>
        {storageError && <Alert variant="info">{storageError}</Alert>}
      </div>
      {analysis ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <h2
              ref={resultRef}
              tabIndex={-1}
              className="min-w-0 text-base font-medium focus:outline-none"
            >
              Analysis · {analyzedName}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => returnToSource(false)}
              >
                Edit source
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => returnToSource(true)}
              >
                Start another
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {keepInTab
              ? storageError
                ? "Browser storage needs attention. Saved data may remain; see the message above."
                : "Source text and this result are saved in this browser tab."
              : "This result is not saved. Refreshing or leaving this page clears it."}
          </p>
          <AnalysisReport analysis={analysis} />
        </>
      ) : (
        <>
          <h2
            ref={sourceRef}
            tabIndex={-1}
            className="text-base font-medium focus:outline-none"
          >
            Choose an analysis source
          </h2>
          <fieldset
            disabled={loading}
            className="min-w-0 space-y-5 disabled:opacity-70"
            aria-busy={loading}
          >
            <legend className="sr-only">Deck source</legend>
            <div className="flex flex-wrap gap-5">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={fieldId + "-mode"}
                  value="file"
                  checked={mode === "file"}
                  onChange={() => {
                    setMode("file");
                    setError(null);
                  }}
                  className="accent-foreground"
                />
                Upload file
              </label>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={fieldId + "-mode"}
                  value="text"
                  checked={mode === "text"}
                  onChange={() => {
                    setMode("text");
                    setError(null);
                  }}
                  className="accent-foreground"
                />
                Paste text
              </label>
            </div>
            {mode === "file" ? (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!loading) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (loading) return;
                  if (event.dataTransfer.files.length > 1) {
                    setFile(null);
                    setRestoredFilename("");
                    setError(
                      "Analyze one document at a time. Choose a single file.",
                    );
                  } else selectFile(event.dataTransfer.files[0]);
                }}
                className={cn(
                  "min-w-0 space-y-4 border border-dashed px-5 py-8",
                  dragging ? "border-foreground bg-secondary" : "border-input",
                )}
              >
                <UploadCloud
                  className="h-7 w-7 text-muted-foreground"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-base font-medium">
                    Drop a pitch deck here
                  </p>
                  <p
                    id={fieldId + "-file-help"}
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    {UPLOAD.ACCEPTED_EXTENSIONS.join(" · ")} · up to{" "}
                    {UPLOAD.MAX_SIZE_BYTES / (1024 * 1024)} MB · one file
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => inputRef.current?.click()}
                  aria-describedby={
                    fieldId +
                    "-file-help" +
                    (error ? " " + fieldId + "-error" : "")
                  }
                >
                  Browse files
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={UPLOAD.ACCEPTED_EXTENSIONS.join(",")}
                  tabIndex={-1}
                  aria-label="Choose deck file"
                  className="hidden"
                  onChange={(event) => {
                    selectFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                {file && (
                  <div className="flex min-w-0 items-center gap-3 border-t border-border pt-3">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove file"
                      onClick={() => {
                        setFile(null);
                        setRestoredFilename("");
                        setError(null);
                        setNotice("File removed.");
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
                {!file && restoredFilename && (
                  <Alert variant="info">
                    Previously selected: {restoredFilename}. Reselect this file
                    to run another analysis; file contents were not saved.
                  </Alert>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label
                  htmlFor={fieldId + "-text"}
                  className="block text-sm font-medium"
                >
                  Deck or memo text
                </label>
                <textarea
                  id={fieldId + "-text"}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={7}
                  aria-invalid={Boolean(error)}
                  aria-describedby={
                    fieldId +
                    "-text-help" +
                    (error ? " " + fieldId + "-error" : "")
                  }
                  placeholder="Paste the deck or memo text…"
                  className="w-full resize-y border border-input bg-background p-3 text-base leading-relaxed focus:border-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                />
                <p
                  id={fieldId + "-text-help"}
                  className="text-sm text-muted-foreground"
                >
                  At least 30 characters. Only this text is submitted in Paste
                  text mode.
                </p>
              </div>
            )}
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Or analyze a fictional sample
              </p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_DECKS.map((deck) => (
                  <Button
                    key={deck.id}
                    variant="secondary"
                    onClick={() => runSample(deck)}
                  >
                    {deck.label}
                  </Button>
                ))}
              </div>
            </div>
          </fieldset>
          {error && (
            <div id={fieldId + "-error"}>
              <Alert variant="error">{error}</Alert>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void analyze()}
              loading={loading}
              disabled={loading}
              aria-describedby={error ? fieldId + "-error" : undefined}
            >
              {loading
                ? "Analyzing…"
                : error
                  ? "Retry analysis"
                  : "Analyze deal"}
              {!loading && (
                <ArrowRight
                  className="h-4 w-4"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              )}
            </Button>
            {loading && (
              <Button variant="secondary" onClick={cancel}>
                Cancel analysis
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Analysis does not add this source to Company Memory. Browser saving
            is optional and controlled above.
          </p>
        </>
      )}
    </div>
  );
}
