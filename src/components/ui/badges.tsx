/**
 * Small presentational badges shared across the app (no "use client" — these
 * render fine in both server and client components).
 */

import type { ReactNode } from "react";

/** Maps each investment decision to its design-token color. */
const DECISION_TOKEN: Record<string, string> = {
  Invested: "var(--success)",
  Interested: "var(--accent)",
  Tracking: "var(--warning)",
  Passed: "var(--danger)",
};

/** Colored pill for an investment decision (Invested / Interested / …). */
export function DecisionBadge({ decision }: { decision: string }) {
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

/** Neutral pill for metadata like sector / stage. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
