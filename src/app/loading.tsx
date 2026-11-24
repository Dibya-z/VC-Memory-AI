export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading workspace"
      className="mx-auto max-w-3xl space-y-6 py-4"
    >
      <h1 className="font-serif text-3xl">Loading workspace</h1>
      <p role="status" className="text-muted-foreground">
        Retrieving company memory…
      </p>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-10 w-2/3 bg-secondary" />
        <div className="h-40 border border-border bg-secondary" />
        <div className="h-40 border border-border bg-secondary" />
      </div>
    </section>
  );
}
