/**
 * Top bar — minimal, hairline-bottom, transparent. A quiet meta strip rather
 * than a chrome-heavy header.
 */
export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-10">
      <span className="label-eyebrow">Lean VC · Memory Workspace</span>
      <span className="label-eyebrow">Demo</span>
    </header>
  );
}
