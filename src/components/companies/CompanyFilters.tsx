"use client";

/**
 * Sector / decision / stage filters for the Company Memory page. Drives
 * server-side filtering via the URL query string (shareable, no client fetch).
 * Square hairline selects, focus = near-black border (no glow).
 */

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { SECTORS, STAGES, DECISIONS } from "@/config/constants";

type Filters = { sector?: string; decision?: string; stage?: string };

export function CompanyFilters({ current }: { current: Filters }) {
  const router = useRouter();

  function apply(next: Filters) {
    const merged = { ...current, ...next };
    const qs = new URLSearchParams();
    if (merged.sector) qs.set("sector", merged.sector);
    if (merged.decision) qs.set("decision", merged.decision);
    if (merged.stage) qs.set("stage", merged.stage);
    const query = qs.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  const hasAny = Boolean(current.sector || current.decision || current.stage);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={current.sector ?? ""}
        label="Sector"
        options={SECTORS}
        onChange={(v) => apply({ sector: v || undefined })}
      />
      <Select
        value={current.decision ?? ""}
        label="Decision"
        options={DECISIONS}
        onChange={(v) => apply({ decision: v || undefined })}
      />
      <Select
        value={current.stage ?? ""}
        label="Stage"
        options={STAGES}
        onChange={(v) => apply({ stage: v || undefined })}
      />
      {hasAny && (
        <button
          type="button"
          onClick={() => router.push("/companies")}
          className="inline-flex items-center gap-1.5 px-2 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} /> Clear
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  label,
  options,
  onChange,
}: {
  value: string;
  label: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 border border-input bg-background px-3 text-[14px] text-foreground transition-colors focus:border-foreground focus:outline-none"
    >
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
