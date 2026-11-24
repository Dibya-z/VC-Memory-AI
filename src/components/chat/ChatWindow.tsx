"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Loader2,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import type { Citation } from "@/lib/types";
import { CHAT_LIMITS, recentChatHistory } from "@/lib/chat-context";
import { requestJson } from "@/lib/client/request";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  excludeFromContext?: boolean;
  status?: string;
}
interface ChatResponse {
  answer: string;
  citations?: Citation[];
  activeCompanyId?: string | null;
  status?: string;
}
interface RetryRequest {
  question: string;
  before: Msg[];
  companyId: string | null;
}
const STORAGE_KEY = "vc-memory-chat-tab-v1";
const FAILED_STATUSES = ["incomplete", "provider_error", "invalid_response"];
const SUGGESTIONS = [
  "Which startups did we pass on, and why?",
  "Prep me for a meeting with FlowAI.",
  "Have we seen any AI coding assistants before?",
  "Summarize what we know in Developer Tools.",
];
interface ChatSnapshot {
  messages: Msg[];
  input: string;
  activeCompanyId: string | null;
  keepInTab: boolean;
  storageReady: boolean;
}
function persistChat(snapshot: ChatSnapshot) {
  if (!snapshot.storageReady) return;
  if (!snapshot.keepInTab) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  const saved = JSON.stringify({
    messages: snapshot.messages.slice(-100),
    input: snapshot.input,
    activeCompanyId: snapshot.activeCompanyId,
  });
  if (saved.length >= 1_000_000) throw new Error("Storage limit");
  sessionStorage.setItem(STORAGE_KEY, saved);
}
const messageId = () => crypto.randomUUID();
function isCitation(value: unknown): value is Citation {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.snippet === "string" &&
    [
      "companyId",
      "companyName",
      "documentId",
      "documentName",
      "documentType",
      "chunkId",
      "sourceDate",
      "uploadedAt",
      "quote",
      "evidenceId",
    ].every((key) => c[key] == null || typeof c[key] === "string") &&
    (c.location == null ||
      (typeof c.location === "object" &&
        Number.isInteger((c.location as Citation["location"])?.start) &&
        Number.isInteger((c.location as Citation["location"])?.end)))
  );
}

function readChatSession() {
  const empty = {
    messages: [] as Msg[],
    input: "",
    activeCompanyId: null as string | null,
    keepInTab: false,
    error: "",
  };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length >= 1_000_000) return empty;
    const saved = JSON.parse(raw);
    if (
      !saved ||
      !Array.isArray(saved.messages) ||
      !saved.messages.every(
        (m: Msg) =>
          m &&
          typeof m.id === "string" &&
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string" &&
          (!m.citations ||
            (Array.isArray(m.citations) && m.citations.every(isCitation))),
      )
    )
      return empty;
    return {
      messages: saved.messages.slice(-100) as Msg[],
      input:
        typeof saved.input === "string"
          ? saved.input.slice(0, CHAT_LIMITS.messageChars)
          : "",
      activeCompanyId:
        typeof saved.activeCompanyId === "string"
          ? saved.activeCompanyId
          : null,
      keepInTab: true,
      error: "",
    };
  } catch {
    return {
      ...empty,
      error:
        "This browser could not restore the saved chat. You can continue without saving.",
    };
  }
}

export function ChatWindow() {
  const hydrated = useHydrated();
  return hydrated ? (
    <ChatSession />
  ) : (
    <p role="status" className="text-sm text-muted-foreground">
      Loading conversation…
    </p>
  );
}

function ChatSession() {
  const [initial] = useState(readChatSession);
  const [messages, setMessages] = useState<Msg[]>(initial.messages);
  const [input, setInput] = useState(initial.input);
  const [loading, setLoading] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    initial.activeCompanyId,
  );
  const [keepInTab, setKeepInTab] = useState(initial.keepInTab);
  const storageReady = true;
  const [storageError, setStorageError] = useState(initial.error);
  const [retryRequest, setRetryRequest] = useState<RetryRequest | null>(null);
  const [newAnswer, setNewAnswer] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const mountedRef = useRef(true);
  const nearBottom = useRef(true);
  const shouldScroll = useRef(false);
  const storageSnapshot = useRef<ChatSnapshot>({
    messages,
    input,
    activeCompanyId,
    keepInTab,
    storageReady,
  });
  useEffect(() => {
    storageSnapshot.current = {
      messages,
      input,
      activeCompanyId,
      keepInTab,
      storageReady,
    };
  }, [messages, input, activeCompanyId, keepInTab, storageReady]);

  useEffect(() => {
    mountedRef.current = true;
    const onScroll = () => {
      nearBottom.current =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 180;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const save = () => {
      try {
        persistChat(storageSnapshot.current);
        setStorageError("");
      } catch {
        setStorageError(
          keepInTab
            ? "The chat could not be saved in this tab. Keep the page open or copy important answers."
            : "Browser storage is unavailable. Previously saved data may remain; clear this site’s browser data to remove it.",
        );
      }
    };
    const timer = window.setTimeout(save, keepInTab ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [messages, input, activeCompanyId, keepInTab, storageReady]);

  useEffect(() => {
    const flush = () => {
      try {
        persistChat(storageSnapshot.current);
      } catch {
        /* Optional cache must not block navigation. */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const scrollToLatest = useCallback(() => {
    endRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "end",
    });
    setNewAnswer(false);
  }, []);
  useEffect(() => {
    if (!messages.length) return;
    if (shouldScroll.current || nearBottom.current) {
      const frame = requestAnimationFrame(scrollToLatest);
      shouldScroll.current = false;
      return () => cancelAnimationFrame(frame);
    }
  }, [messages, loading, scrollToLatest]);

  useEffect(() => {
    const field = inputRef.current;
    if (field) {
      field.style.height = "auto";
      field.style.height = `${Math.min(field.scrollHeight, 192)}px`;
    }
  }, [input]);

  async function send(text: string, retry?: RetryRequest) {
    const question = text.trim();
    if (
      !question ||
      question.length > CHAT_LIMITS.messageChars ||
      requestRef.current
    )
      return;
    const before = retry?.before ?? messages;
    const companyId = retry ? retry.companyId : activeCompanyId;
    const controller = new AbortController();
    requestRef.current = controller;
    const id = ++requestId.current;
    if (!retry) setInput("");
    setRetryRequest(null);
    setNewAnswer(false);
    shouldScroll.current = true;
    setMessages([
      ...before,
      { id: messageId(), role: "user", content: question },
    ]);
    setLoading(true);
    const snapshot = { question, before, companyId };
    try {
      const data = await requestJson<ChatResponse>("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: recentChatHistory(before),
          ...(companyId ? { activeCompanyId: companyId } : {}),
        }),
      });
      if (!mountedRef.current || id !== requestId.current) return;
      if (
        typeof data.answer !== "string" ||
        !data.answer.trim() ||
        (data.citations &&
          (!Array.isArray(data.citations) || !data.citations.every(isCitation)))
      )
        throw new Error("The answer could not be read. Please retry.");
      const failed = FAILED_STATUSES.includes(data.status ?? "");
      if (!nearBottom.current) setNewAnswer(true);
      setActiveCompanyId(data.activeCompanyId ?? null);
      setMessages((m) => [
        ...m,
        {
          id: messageId(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          status: data.status,
          excludeFromContext: failed,
        },
      ]);
      if (failed) setRetryRequest(snapshot);
    } catch (error) {
      if (!mountedRef.current || id !== requestId.current) return;
      if (!nearBottom.current) setNewAnswer(true);
      const content = controller.signal.aborted
        ? "Stopped waiting for this answer. You can retry the question."
        : error instanceof Error
          ? error.message
          : "Could not complete this answer. Please retry.";
      setMessages((m) => [
        ...m,
        {
          id: messageId(),
          role: "assistant",
          content,
          excludeFromContext: true,
        },
      ]);
      setRetryRequest(snapshot);
    } finally {
      if (mountedRef.current && id === requestId.current) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  function reset() {
    if (
      !window.confirm("Clear this conversation and its saved copy in this tab?")
    )
      return;
    if (keepInTab) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        setStorageError(
          "Could not remove the saved chat. Clear this site’s browser data to remove it.",
        );
        return;
      }
    }
    requestId.current++;
    requestRef.current?.abort();
    requestRef.current = null;
    setMessages([]);
    setInput("");
    setActiveCompanyId(null);
    setRetryRequest(null);
    setLoading(false);
    setNewAnswer(false);
    setShowAll(false);
    setKeepInTab(false);

    inputRef.current?.focus();
  }

  const visibleMessages = showAll ? messages : messages.slice(-40);
  return (
    <section className="min-w-0 space-y-6" aria-label="Memory conversation">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={keepInTab}
            onChange={(e) => {
              if (!e.target.checked) {
                try {
                  sessionStorage.removeItem(STORAGE_KEY);
                } catch {
                  setStorageError(
                    "Could not remove the saved chat. Clear this site’s browser data to remove it.",
                  );
                  return;
                }
              }
              setKeepInTab(e.target.checked);
            }}
            aria-describedby="chat-storage-help"
          />
          Keep this chat in this tab
        </label>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <Trash2 size={16} aria-hidden="true" /> Clear chat
          </Button>
        )}
        <p
          id="chat-storage-help"
          className="w-full text-xs leading-relaxed text-muted-foreground"
        >
          Saving is optional and uses this browser tab only. Turn it off or
          clear the chat to remove the saved copy. At most 100 messages are
          retained.
        </p>
      </div>
      {storageError && <Alert variant="info">{storageError}</Alert>}
      {messages.length === 0 ? (
        <EmptyState onPick={(q) => void send(q)} />
      ) : (
        <>
          {!showAll && messages.length > 40 && (
            <Button variant="secondary" onClick={() => setShowAll(true)}>
              Show {messages.length - 40} earlier messages
            </Button>
          )}
          <div
            className="space-y-8"
            role="log"
            aria-label="Memory chat"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={loading}
          >
            {visibleMessages.map((message) => (
              <Message key={message.id} msg={message} />
            ))}
            {loading && (
              <p className="flex items-center gap-2 border-l border-border pl-4 text-sm text-muted-foreground">
                <Loader2
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />{" "}
                Searching memory and preparing an answer…
              </p>
            )}
            <div ref={endRef} />
          </div>
        </>
      )}
      {retryRequest && (
        <Button
          variant="secondary"
          onClick={() => void send(retryRequest.question, retryRequest)}
        >
          <RotateCcw size={16} aria-hidden="true" /> Retry last question
        </Button>
      )}
      <div className="sticky bottom-0 z-10 space-y-3 border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {newAnswer && (
          <Button variant="secondary" size="sm" onClick={scrollToLatest}>
            <ArrowDown size={16} aria-hidden="true" /> Jump to latest answer
          </Button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="memory-question" className="field-label mb-2 block">
              Ask the firm’s memory
            </label>
            <textarea
              ref={inputRef}
              id="memory-question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the recorded companies…"
              rows={2}
              maxLength={CHAT_LIMITS.messageChars}
              aria-describedby="chat-input-help"
              className="field-control block min-h-12 w-full resize-none overflow-y-auto"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
          </div>
          {loading ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => requestRef.current?.abort()}
              aria-label="Stop waiting"
            >
              <Square size={17} aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label="Send"
            >
              <ArrowUp size={20} aria-hidden="true" />
            </Button>
          )}
        </form>
        <p id="chat-input-help" className="text-xs text-muted-foreground">
          Enter to send · Shift+Enter for a new line ·{" "}
          {input.length.toLocaleString()}/
          {CHAT_LIMITS.messageChars.toLocaleString()}
        </p>
      </div>
    </section>
  );
}

function Message({ msg }: { msg: Msg }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const references = new Map(
    (msg.citations ?? [])
      .filter((c) => c.evidenceId)
      .map((c) => [c.evidenceId!, c]),
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <article
      className="min-w-0"
      aria-label={msg.role === "user" ? "Your question" : "Memory answer"}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label-eyebrow">
          {msg.role === "user" ? "You" : "Memory"}
        </p>
        {msg.role === "assistant" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copy()}
            aria-label="Copy answer"
          >
            <Copy size={14} aria-hidden="true" /> {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
      {copyError && (
        <p role="status" className="mb-2 text-sm text-muted-foreground">
          Copy is unavailable. Select the answer text to copy it.
        </p>
      )}
      <div
        className={`whitespace-pre-wrap [overflow-wrap:anywhere] text-[0.9375rem] leading-relaxed ${msg.role === "assistant" ? "border-l border-border pl-4" : ""}`}
      >
        {msg.content.split(/(\[P\d+\])/g).map((part, index) => {
          const citation = references.get(part.slice(1, -1));
          return citation ? (
            <a
              key={index}
              href={`#${msg.id}-${citation.evidenceId}`}
              onClick={() => {
                const details = document.getElementById(
                  `${msg.id}-sources`,
                ) as HTMLDetailsElement | null;
                if (details) details.open = true;
                requestAnimationFrame(() =>
                  document
                    .getElementById(`${msg.id}-${citation.evidenceId}`)
                    ?.focus(),
                );
              }}
              className="text-link font-medium"
              aria-label={`View source ${citation.evidenceId}`}
            >
              {part}
            </a>
          ) : (
            <Fragment key={index}>{part}</Fragment>
          );
        })}
      </div>
      {msg.citations && msg.citations.length > 0 && (
        <Citations citations={msg.citations} messageId={msg.id} />
      )}
    </article>
  );
}

function sourceHref(c: Citation) {
  if (!c.companyId) return null;
  const company = `/companies/${encodeURIComponent(c.companyId)}`;
  if (!c.documentId) return company;
  const params = new URLSearchParams();
  if (
    c.location &&
    Number.isInteger(c.location.start) &&
    Number.isInteger(c.location.end) &&
    c.location.start >= 0 &&
    c.location.end > c.location.start
  ) {
    params.set("start", String(c.location.start));
    params.set("end", String(c.location.end));
  }
  return `${company}/documents/${encodeURIComponent(c.documentId)}${params.size ? `?${params}#source-passage` : ""}`;
}
function Citations({
  citations,
  messageId: id,
}: {
  citations: Citation[];
  messageId: string;
}) {
  return (
    <details id={`${id}-sources`} className="mt-4 border-t border-border pt-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
        Sources ({citations.length})
      </summary>
      <ol className="mt-3 space-y-5">
        {citations.map((c, index) => {
          const href = sourceHref(c);
          return (
            <li
              key={`${c.evidenceId ?? index}-${index}`}
              id={`${id}-${c.evidenceId ?? index}`}
              tabIndex={-1}
              className="scroll-mt-6 [overflow-wrap:anywhere] border-l border-border pl-4 text-sm leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <p className="font-medium">
                {c.evidenceId ? `${c.evidenceId} · ` : ""}
                {c.companyName ?? "Company"}
                {c.documentName ? ` · ${c.documentName}` : " · Company record"}
              </p>
              {c.sourceDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Source date: {c.sourceDate}
                </p>
              )}
              <blockquote className="my-2 text-muted-foreground">
                {c.quote ?? c.snippet}
              </blockquote>
              {href && (
                <Link
                  href={href}
                  className="text-link inline-flex min-h-11 items-center"
                >
                  {c.documentId
                    ? "Read passage in document"
                    : "Open company record"}
                </Link>
              )}
              {c.location && (
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer py-2">
                    Source location details
                  </summary>
                  Extracted-text characters {c.location.start + 1}–
                  {c.location.end}; not a PDF page number.
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="border-t border-border pt-6">
      <h2 className="label-eyebrow mb-4">Try asking</h2>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((question) => (
          <Button
            key={question}
            variant="secondary"
            onClick={() => onPick(question)}
            className="h-auto min-h-11 text-left"
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
