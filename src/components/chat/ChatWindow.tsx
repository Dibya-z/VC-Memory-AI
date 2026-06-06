"use client";

/**
 * Memory chat surface (Feature 2): message list, composer, and citations under
 * assistant answers. Stateless API; conversation state lives here. Editorial,
 * restrained styling.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Loader2 } from "lucide-react";
import type { Citation } from "@/lib/types";

interface Msg {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

const SUGGESTIONS = [
  "Which startups did we pass on, and why?",
  "What were our concerns about FlowAI?",
  "Have we seen any AI coding assistants before?",
  "Summarize what we know in Developer Tools.",
];

export function ChatWindow() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {messages.length === 0 ? (
        <EmptyState onPick={send} />
      ) : (
        <div className="space-y-8">
          {messages.map((m, i) => (
            <Message key={i} msg={m} />
          ))}
          {loading && <Pending />}
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the firm's memory…"
          className="h-12 flex-1 border border-input bg-background px-4 text-[15px] transition-colors focus:border-foreground focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          aria-label="Send"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </form>
    </div>
  );
}

function Message({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div>
      <p className="label-eyebrow mb-2">{isUser ? "You" : "Memory"}</p>
      <div
        className={
          isUser
            ? "whitespace-pre-wrap text-[15px] leading-relaxed"
            : "whitespace-pre-wrap border-l border-border pl-4 text-[15px] leading-relaxed"
        }
      >
        {msg.content}
      </div>
      {msg.citations && msg.citations.length > 0 && (
        <Citations citations={msg.citations} />
      )}
    </div>
  );
}

function Citations({ citations }: { citations: Citation[] }) {
  return (
    <div className="mt-4 border-t border-border pt-3 pl-4">
      <p className="label-eyebrow mb-2">Sources</p>
      <ul className="space-y-1.5">
        {citations.map((c, i) => (
          <li key={i} className="text-[13px] leading-relaxed">
            {c.companyId ? (
              <Link
                href={`/companies/${c.companyId}`}
                className="font-medium underline-offset-2 transition-colors hover:text-accent hover:underline"
              >
                {c.companyName ?? "Company"}
              </Link>
            ) : (
              <span className="font-medium">{c.companyName ?? "Company"}</span>
            )}
            <span className="text-muted-foreground"> — {c.snippet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pending() {
  return (
    <div>
      <p className="label-eyebrow mb-2">Memory</p>
      <p className="flex items-center gap-2 border-l border-border pl-4 text-[15px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        Searching the firm&apos;s memory…
      </p>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="border-t border-border pt-8">
      <p className="label-eyebrow mb-4">Try asking</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="border border-border px-3 py-2 text-left text-[14px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
