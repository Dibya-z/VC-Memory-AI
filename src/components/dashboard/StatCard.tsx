/**
 * A dashboard metric tile — a large thin number above a small uppercase label,
 * inside a clean hairline card (no shadow, square corners).
 */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border border-border bg-card p-6">
      <div className="text-5xl font-light leading-none tracking-tight tabular-nums">
        {value}
      </div>
      <div className="label-eyebrow mt-4">{label}</div>
      {hint ? (
        <div className="mt-2 text-[13px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
