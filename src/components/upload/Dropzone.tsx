"use client";

/**
 * Drag-and-drop upload control (Feature 1). Validates against config UPLOAD,
 * POSTs each file to /api/upload, and surfaces per-file processing/error state
 * plus the extracted-intelligence result card on success.
 */

import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD } from "@/config/constants";
import type { ExtractedIntelligence, UploadResult } from "@/lib/types";

type Status = "uploading" | "done" | "error";

interface Item {
  id: string;
  filename: string;
  status: Status;
  result?: UploadResult;
}

let counter = 0;

export function Dropzone() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    const id = `f${counter++}`;
    const clientError = clientValidate(file);
    if (clientError) {
      setItems((prev) => [
        { id, filename: file.name, status: "error", result: { filename: file.name, ok: false, error: clientError } },
        ...prev,
      ]);
      return;
    }

    setItems((prev) => [{ id, filename: file.name, status: "uploading" }, ...prev]);

    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      const result: UploadResult | undefined = data.results?.[0];
      if (!res.ok || !result) throw new Error(data.error ?? "Upload failed.");
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: result.ok ? "done" : "error", result } : it
        )
      );
    } catch (e) {
      const error = e instanceof Error ? e.message : "Upload failed.";
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, status: "error", result: { filename: file.name, ok: false, error } }
            : it
        )
      );
    }
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      // Sequential — gentle on Groq's free-tier rate limit and gives clean
      // incremental per-file feedback.
      for (const file of Array.from(fileList)) {
        await upload(file);
      }
    },
    [upload]
  );

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/60 hover:bg-muted/40"
        )}
      >
        <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop pitch decks, memos, or notes — or click to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {UPLOAD.ACCEPTED_EXTENSIONS.join(" · ")} · up to{" "}
          {(UPLOAD.MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD.ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <FileRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({ item }: { item: Item }) {
  const { status, result } = item;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">{item.filename}</span>
        <StatusPill status={status} />
      </div>

      {status === "error" && result?.error && (
        <p className="mt-2 pl-7 text-sm text-danger">{result.error}</p>
      )}

      {status === "done" && result?.intelligence && (
        <IntelligenceCard intelligence={result.intelligence} />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "uploading")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading & extracting…
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger">
        <AlertCircle className="h-3.5 w-3.5" /> Failed
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-success">
      <CheckCircle2 className="h-3.5 w-3.5" /> Added to memory
    </span>
  );
}

function IntelligenceCard({ intelligence }: { intelligence: ExtractedIntelligence }) {
  const i = intelligence;
  return (
    <div className="mt-3 space-y-3 border-t pt-3 pl-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">{i.company}</span>
        {i.sector && <Chip>{i.sector}</Chip>}
        {i.stage && <Chip>{i.stage}</Chip>}
        {i.decision && <DecisionBadge decision={i.decision} />}
      </div>

      {i.oneLiner && <p className="text-sm text-muted-foreground">{i.oneLiner}</p>}

      {i.decision && i.decisionReason && (
        <p className="text-sm">
          <span className="font-medium">Why {i.decision.toLowerCase()}: </span>
          {i.decisionReason}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <BulletList label="Strengths" items={i.strengths} tone="success" />
        <BulletList label="Risks" items={i.risks} tone="danger" />
        {i.concerns && i.concerns.length > 0 && (
          <BulletList label="Concerns" items={i.concerns} tone="warning" />
        )}
        {i.founders && i.founders.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Founders
            </p>
            <ul className="space-y-0.5 text-sm">
              {i.founders.map((f, idx) => (
                <li key={idx}>
                  {f.name}
                  {f.role ? ` — ${f.role}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {i.traction && (
        <p className="text-sm">
          <span className="font-medium">Traction: </span>
          {i.traction}
        </p>
      )}
    </div>
  );
}

function BulletList({
  label,
  items,
  tone,
}: {
  label: string;
  items?: string[];
  tone: "success" | "danger" | "warning";
}) {
  if (!items || items.length === 0) return null;
  const dot =
    tone === "success" ? "var(--success)" : tone === "danger" ? "var(--danger)" : "var(--warning)";
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((it, idx) => (
          <li key={idx} className="flex gap-2">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: `hsl(${dot})` }}
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

const DECISION_TOKEN: Record<string, string> = {
  Invested: "var(--success)",
  Interested: "var(--accent)",
  Tracking: "var(--warning)",
  Passed: "var(--danger)",
};

function DecisionBadge({ decision }: { decision: string }) {
  const token = DECISION_TOKEN[decision];
  const style = token
    ? {
        color: `hsl(${token})`,
        backgroundColor: `hsl(${token} / 0.1)`,
        borderColor: `hsl(${token} / 0.25)`,
      }
    : undefined;
  return (
    <span
      className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={style}
    >
      {decision}
    </span>
  );
}

function clientValidate(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!UPLOAD.ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `Unsupported type — use ${UPLOAD.ACCEPTED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > UPLOAD.MAX_SIZE_BYTES) {
    return `Too large (max ${(UPLOAD.MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB).`;
  }
  if (file.size === 0) return "File is empty.";
  return null;
}
