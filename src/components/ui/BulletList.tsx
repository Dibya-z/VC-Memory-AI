/**
 * A labeled bullet list with a tone-colored marker. Used for strengths / risks /
 * concerns across the upload result card and the company detail page.
 */

type Tone = "success" | "danger" | "warning" | "neutral";

const TONE_TOKEN: Record<Tone, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  neutral: "var(--muted-foreground)",
};

export function BulletList({
  label,
  items,
  tone = "neutral",
}: {
  label: string;
  items?: string[];
  tone?: Tone;
}) {
  if (!items || items.length === 0) return null;
  const dot = TONE_TOKEN[tone];
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-2">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: `hsl(${dot})` }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
