"use client";

import { Menu } from "lucide-react";

/**
 * Top bar — minimal, hairline-bottom. On mobile it hosts the nav toggle; the
 * left workspace label is hidden on small screens to make room.
 */
export function TopBar({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 lg:px-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="-ml-1 text-foreground transition-colors hover:text-muted-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <span className="label-eyebrow hidden sm:inline">
          Lean VC · Memory Workspace
        </span>
      </div>
      <span
        className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
        title="A safe sandbox pre-loaded with fictional sample startups. Explore freely — no real data."
      >
        <span className="h-[6px] w-[6px] rounded-full bg-accent" />
        Demo workspace · sample data
      </span>
    </header>
  );
}
