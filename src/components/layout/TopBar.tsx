/**
 * Top bar — minimal, hairline-bottom, transparent. A quiet meta strip rather
 * than a chrome-heavy header.
 */
export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-10">
      <span className="label-eyebrow">Lean VC · Memory Workspace</span>
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
