/**
 * Small presentational badges shared across the app (no "use client" — these
 * render fine in both server and client components). Restrained, editorial:
 * decisions are a colored dot + uppercase label (semantic status, not a pill);
 * meta chips are hairline-bordered, square, no fill.
 */

import type { ReactNode } from "react";

/** Maps each investment decision to its semantic design-token color. */
const DECISION_TOKEN: Record<string, string> = {
  Invested: "var(--success)",
  Interested: "var(--accent)",
  Tracking: "var(--warning)",
  Passed: "var(--danger)",
};

/** Status label for an investment decision: dot + small uppercase text. */
export function DecisionBadge({ decision }: { decision: string }) {
  const token = DECISION_TOKEN[decision] ?? "var(--muted-foreground)";
  const color = `hsl(${token})`;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em]"
      style={{ color }}
    >
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: color }}
      />
      {decision}
    </span>
  );
}

/** Hairline tag for metadata like sector / stage. Square, no fill. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border border-border px-2 py-0.5 text-[13px] text-muted-foreground">
      {children}
    </span>
  );
}
