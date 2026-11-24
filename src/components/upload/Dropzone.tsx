"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD } from "@/config/constants";
import { SAMPLE_DECKS } from "@/config/sample-decks";
import { Chip, DecisionBadge } from "@/components/ui/badges";
import { BulletList } from "@/components/ui/BulletList";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { documentFileKey, validateDocumentFile } from "@/lib/client/files";
import { requestJson } from "@/lib/client/request";
import { parseSingleUploadResponse } from "@/lib/client/upload-response";
import type { ExtractedIntelligence, UploadResult } from "@/lib/types";

type Status =
  "queued" | "processing" | "pending" | "done" | "error" | "stopped";
interface Item {
  id: string;
  key: string;
  file: File;
  status: Status;
  validationError?: string;
  result?: UploadResult;
}

/** One worker owns every selection and sample in this component's lifetime. */
export function Dropzone() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [stoppedNotice, setStoppedNotice] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  const workerRef = useRef(false);
  const mountedRef = useRef(true);
  const activeRef = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );
  const sequenceRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const helpId = useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current?.controller.abort();
    };
  }, []);

  const updateItems = useCallback((change: (previous: Item[]) => Item[]) => {
    const next = change(itemsRef.current);
    itemsRef.current = next;
    if (mountedRef.current) setItems(next);
  }, []);

  const processQueue = useCallback(async () => {
    if (workerRef.current || !mountedRef.current) return;
    workerRef.current = true;
    try {
      while (mountedRef.current) {
        const item = itemsRef.current.find(
          (entry) => entry.status === "queued",
        );
        if (!item) break;
        const controller = new AbortController();
        activeRef.current = { id: item.id, controller };
        updateItems((previous) =>
          previous.map((entry) =>
            entry.id === item.id ? { ...entry, status: "processing" } : entry,
          ),
        );
        setNotice("Processing " + item.file.name + ".");
        try {
          const body = new FormData();
          body.append("files", item.file);
          const data = await requestJson<unknown>("/api/upload", {
            method: "POST",
            body,
            signal: controller.signal,
          });
          if (!mountedRef.current || controller.signal.aborted) continue;
          const result = parseSingleUploadResponse(data);
          if (!result)
            throw new Error(
              "The server returned an incomplete upload result. The document may already have been saved. Check Company Memory before retrying.",
            );
          updateItems((previous) =>
            previous.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: result.ok
                      ? "done"
                      : result.pending
                        ? "pending"
                        : "error",
                    result,
                  }
                : entry,
            ),
          );
          setNotice(
            item.file.name +
              (result.ok
                ? " added to memory."
                : result.pending
                  ? " is already processing on the server. Check its status shortly."
                  : " could not be processed."),
          );
        } catch (cause) {
          if (!mountedRef.current || controller.signal.aborted) continue;
          const error =
            cause instanceof Error
              ? cause.message
              : "Upload failed. Check Company Memory before retrying.";
          updateItems((previous) =>
            previous.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: "error",
                    result: { filename: item.file.name, ok: false, error },
                  }
                : entry,
            ),
          );
          setNotice("Processing failed for " + item.file.name + ".");
        } finally {
          if (activeRef.current?.controller === controller)
            activeRef.current = null;
        }
      }
    } finally {
      workerRef.current = false;
    }
  }, [updateItems]);

  function enqueue(files: File[]) {
    const additions: Item[] = [];
    let duplicates = 0;
    for (const file of files) {
      const key = documentFileKey(file);
      if (
        [...itemsRef.current, ...additions].some((entry) => entry.key === key)
      ) {
        duplicates++;
        continue;
      }
      const validationError = validateDocumentFile(file) ?? undefined;
      additions.push({
        id: "upload-" + sequenceRef.current++,
        key,
        file,
        status: validationError ? "error" : "queued",
        validationError,
        ...(validationError
          ? {
              result: {
                filename: file.name,
                ok: false,
                error: validationError,
              },
            }
          : {}),
      });
    }
    updateItems((previous) => [...previous, ...additions]);
    setNotice(
      additions.length +
        " document(s) added to the list." +
        (duplicates
          ? " " +
            duplicates +
            " repeated selection(s) skipped. Use the existing row to retry."
          : ""),
    );
    void processQueue();
  }

  function remove(id: string) {
    updateItems((previous) => previous.filter((entry) => entry.id !== id));
    setNotice("Document removed from the list.");
  }

  function stopWaiting(id: string) {
    updateItems((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, status: "stopped" } : entry,
      ),
    );
    if (activeRef.current?.id === id) activeRef.current.controller.abort();
    setStoppedNotice(true);
    setNotice(
      "Stopped waiting. The server may still finish processing this document. Check Company Memory before retrying.",
    );
  }

  function retry(id: string) {
    updateItems((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? { ...entry, status: "queued", result: undefined }
          : entry,
      ),
    );
    void processQueue();
  }

  const remaining = items.filter(
    (item) =>
      item.status === "queued" ||
      item.status === "processing" ||
      item.status === "pending",
  ).length;

  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {notice}
      </p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          enqueue(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "flex min-w-0 flex-col items-start gap-4 border border-dashed px-5 py-10 transition-colors sm:px-8",
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
            Drop pitch decks, memos, or notes here
          </p>
          <p id={helpId} className="mt-1.5 text-sm text-muted-foreground">
            {UPLOAD.ACCEPTED_EXTENSIONS.join(" · ")} · up to{" "}
            {UPLOAD.MAX_SIZE_BYTES / (1024 * 1024)} MB each. Documents process
            one at a time.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          aria-describedby={helpId}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD.ACCEPTED_EXTENSIONS.join(",")}
          aria-label="Choose documents to upload"
          className="hidden"
          onChange={(event) => {
            enqueue(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">
          No file handy? Add a fictional sample
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_DECKS.map((deck) => {
            const key = documentFileKey({
              name: deck.filename,
              size: new Blob([deck.text]).size,
              lastModified: 0,
            });
            const existing = items.find((item) => item.key === key);
            return (
              <Button
                key={deck.id}
                variant="secondary"
                disabled={Boolean(existing)}
                onClick={() =>
                  enqueue([
                    new File([deck.text], deck.filename, {
                      type: "text/markdown",
                      lastModified: 0,
                    }),
                  ])
                }
              >
                {deck.label}
                {existing
                  ? existing.status === "done"
                    ? " · Added"
                    : " · In list"
                  : ""}
              </Button>
            );
          })}
        </div>
      </div>
      {stoppedNotice && (
        <Alert variant="info">
          Stopping the wait does not undo a server upload. Processing may still
          finish. Check{" "}
          <Link href="/companies" className="underline underline-offset-2">
            Company Memory
          </Link>{" "}
          before retrying.
        </Alert>
      )}
      {items.length > 0 && (
        <section aria-labelledby={helpId + "-queue"} className="space-y-4">
          <h2 id={helpId + "-queue"} className="text-base font-medium">
            Upload list{" "}
            <span className="font-normal text-muted-foreground">
              · {remaining} remaining
            </span>
          </h2>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id}>
                <div
                  className="min-w-0 border border-border bg-card p-4"
                  aria-busy={item.status === "processing"}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <FileText
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 basis-40 text-sm font-medium">
                      {item.file.name}
                    </span>
                    <StatusPill status={item.status} />
                  </div>
                  {item.result?.error && (
                    <div className="mt-3">
                      <Alert variant={item.result.pending ? "info" : "error"}>
                        {item.result.error}
                      </Alert>
                    </div>
                  )}
                  {item.status === "stopped" && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      The server may still finish. Check Company Memory before
                      retrying.
                    </p>
                  )}
                  {item.status === "done" && item.result?.reused && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      This document was already stored. The existing result was
                      reused.
                    </p>
                  )}
                  {item.status === "done" && item.result?.intelligence && (
                    <IntelligenceCard intelligence={item.result.intelligence} />
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.status === "processing" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={"Stop waiting for " + item.file.name}
                        onClick={() => stopWaiting(item.id)}
                      >
                        Stop waiting
                      </Button>
                    ) : (
                      <>
                        {(item.status === "error" ||
                          item.status === "pending" ||
                          item.status === "stopped") &&
                          !item.validationError && (
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={
                                (item.status === "pending"
                                  ? "Check upload status for "
                                  : "Retry ") + item.file.name
                              }
                              onClick={() => retry(item.id)}
                            >
                              {item.status === "pending"
                                ? "Check upload"
                                : "Retry upload"}
                            </Button>
                          )}
                        {item.status === "done" && item.result?.companyId && (
                          <Link
                            href={"/companies/" + item.result.companyId}
                            className="inline-flex min-h-11 items-center px-3 text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            Open company
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={"Remove " + item.file.name + " from list"}
                          onClick={() => remove(item.id)}
                        >
                          {item.status === "queued"
                            ? "Remove from queue"
                            : "Remove from list"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Keep this page open until uploads finish. Removing a completed item
            from this list does not delete its saved document.
          </p>
        </section>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const labels: Record<Status, string> = {
    queued: "Queued",
    processing: "Reading & extracting…",
    pending: "Processing on server",
    done: "Added to memory",
    error: "Failed",
    stopped: "Stopped waiting",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        status === "done"
          ? "text-success"
          : status === "error"
            ? "text-danger"
            : "text-muted-foreground",
      )}
    >
      {status === "processing" ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : status === "done" ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ) : status === "error" ? (
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {labels[status]}
    </span>
  );
}

function IntelligenceCard({
  intelligence,
}: {
  intelligence: ExtractedIntelligence;
}) {
  const i = intelligence;
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4 pl-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-medium">{i.company}</span>
        {i.sector && <Chip>{i.sector}</Chip>}
        {i.stage && <Chip>{i.stage}</Chip>}
        {i.decision && <DecisionBadge decision={i.decision} />}
      </div>

      {i.oneLiner && (
        <p className="text-sm text-muted-foreground">{i.oneLiner}</p>
      )}

      {i.decision && i.decisionReason && (
        <p className="text-sm">
          <span className="font-medium">Why {i.decision.toLowerCase()}: </span>
          {i.decisionReason}
        </p>
      )}

      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <BulletList label="Strengths" items={i.strengths} tone="success" />
        <BulletList label="Risks" items={i.risks} tone="danger" />
        {i.concerns && i.concerns.length > 0 && (
          <BulletList label="Concerns" items={i.concerns} tone="warning" />
        )}
        {i.founders && i.founders.length > 0 && (
          <div>
            <p className="label-eyebrow mb-1.5">Founders</p>
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
