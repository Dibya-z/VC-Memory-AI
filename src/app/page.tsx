/**
 * Dashboard (Feature: Dashboard).
 * Shows: companies stored, sectors analyzed, decision breakdown, recent uploads.
 * Data comes from GET /api/stats.
 *
 * TODO(impl): fetch stats, render StatCard grid + SectorBreakdown + RecentUploads.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Your firm&apos;s institutional memory at a glance.
      </p>
      {/* TODO: <StatCard /> grid, <SectorBreakdown />, <RecentUploads /> */}
    </div>
  );
}
