/**
 * Restrained "coming soon" placeholder for features not yet wired up. Dashed
 * hairline frame, a single line icon, muted copy — consistent with the design.
 */

import type { LucideIcon } from "lucide-react";

export function Placeholder({
  icon: Icon,
  title,
  note,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
}) {
  return (
    <div className="border border-dashed border-border px-6 py-20 text-center">
      <Icon
        className="mx-auto mb-4 h-7 w-7 text-muted-foreground"
        strokeWidth={1.5}
      />
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {note}
      </p>
    </div>
  );
}
