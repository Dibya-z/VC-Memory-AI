"use client";

import { Menu } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Top bar — minimal, hairline-bottom. On mobile it hosts the nav toggle; the
 * left workspace label is hidden on small screens to make room.
 */
export function TopBar({
  onMenu,
  menuOpen = false,
  menuRef,
}: {
  onMenu?: () => void;
  menuOpen?: boolean;
  menuRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="app-topbar flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 lg:px-10">
      <div className="flex items-center gap-3">
        <Button
          ref={menuRef}
          variant="ghost"
          size="icon"
          onClick={onMenu}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="workspace-menu"
          className="-ml-1 text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </Button>
        <span className="label-eyebrow hidden sm:inline">
          Lean VC · Memory Workspace
        </span>
      </div>
      <span
        className="inline-flex items-center gap-2 text-right text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
        title="This shared workspace contains sample companies and uploaded documents. Uploads are saved to company memory."
      >
        <span
          aria-hidden="true"
          className="h-[6px] w-[6px] shrink-0 rounded-full bg-accent-art"
        />
        Shared memory workspace
      </span>
    </header>
  );
}
