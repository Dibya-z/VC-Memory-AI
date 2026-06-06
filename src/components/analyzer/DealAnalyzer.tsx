"use client";

/**
 * Deal analyzer input (Feature 3): upload a new deck OR paste text, then run
 * analysis + memory comparison. Renders <AnalysisReport /> on success.
 */

import { useRef, useState } from "react";
import { UploadCloud, Loader2, ArrowRight, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD } from "@/config/constants";
import { AnalysisReport } from "@/components/analyzer/AnalysisReport";
import type { DealAnalysis } from "@/lib/types";

export function DealAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DealAnalysis | null>(null);
  const [analyzedName, setAnalyzedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function analyze() {
    setError(null);
    if (!file && text.trim().length < 30) {
      setError("Upload a deck or paste at least a few sentences.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text.trim());
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setAnalysis(data.analysis);
      setAnalyzedName(data.filename ?? "Pasted deck");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setAnalysis(null);
    setFile(null);
    setText("");
    setError(null);
    setAnalyzedName(null);
  }

  if (analysis) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <p className="label-eyebrow">Analysis · {analyzedName}</p>
          <button
            type="button"
            onClick={reset}
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Analyze another
          </button>
        </div>
        <AnalysisReport analysis={analysis} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File input / dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && inputRef.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-10 text-center transition-colors duration-200",
          dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-foreground/40 hover:bg-secondary"
        )}
      >
        {file ? (
          <span className="flex items-center gap-2 text-[15px] font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            {file.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </span>
        ) : (
          <>
            <UploadCloud
              className="mb-4 h-7 w-7 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="text-[15px] font-medium">
              Drop a new pitch deck — or click to browse
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {UPLOAD.ACCEPTED_EXTENSIONS.join(" · ")}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD.ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>

      {/* or paste */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="label-eyebrow">or paste</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Paste the deck or memo text…"
        className="w-full resize-y border border-input bg-background p-3 text-[15px] leading-relaxed transition-colors focus:border-foreground focus:outline-none"
      />

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <button
        type="button"
        onClick={analyze}
        disabled={loading}
        className="group inline-flex h-12 items-center gap-2 bg-primary px-8 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            Analyzing &amp; searching memory…
          </>
        ) : (
          <>
            Analyze deal
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </>
        )}
      </button>
    </div>
  );
}
