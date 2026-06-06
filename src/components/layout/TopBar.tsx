/**
 * Top bar. Placeholder for a global memory-search box and firm/profile switcher.
 * TODO(impl): wire the search box to /chat or a quick company lookup.
 */
export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-8">
      <div className="text-sm text-muted-foreground">
        Lean VC · Memory Workspace
      </div>
      <div className="text-xs text-muted-foreground">Demo workspace</div>
    </header>
  );
}
