/**
 * Dashboard. The firm's institutional memory at a glance: how much is stored,
 * the decision + sector mix, and the most recent uploads. Reads the query layer
 * directly (server component).
 */

import Link from "next/link";
import { Building2, FileText, Layers, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { DecisionBadge } from "@/components/ui/badges";
import { getDashboardStats } from "@/lib/db/queries";
import { timeAgo } from "@/lib/utils";

// Always reflect the latest DB state rather than prerendering at build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your firm&apos;s institutional memory at a glance.
        </p>
      </div>

      {stats.companyCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Companies in memory"
              value={stats.companyCount}
              hint="Startups the firm has reviewed"
            />
            <StatCard
              label="Documents ingested"
              value={stats.documentCount}
              hint="Decks, memos, and notes"
            />
            <StatCard
              label="Sectors tracked"
              value={stats.sectorBreakdown.length}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="By decision">
              {stats.decisionBreakdown.length === 0 ? (
                <Muted>No decisions recorded yet.</Muted>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {stats.decisionBreakdown.map((d) => (
                    <div key={d.decision} className="flex items-center gap-2">
                      <DecisionBadge decision={d.decision} />
                      <span className="text-sm text-muted-foreground">
                        {d.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="By sector">
              {stats.sectorBreakdown.length === 0 ? (
                <Muted>No sectors yet.</Muted>
              ) : (
                <SectorBars data={stats.sectorBreakdown} />
              )}
            </Panel>
          </div>

          <Panel title="Recent uploads">
            {stats.recentUploads.length === 0 ? (
              <Muted>Nothing uploaded yet.</Muted>
            ) : (
              <ul className="divide-y">
                {stats.recentUploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">{u.filename}</span>
                    {u.companyName && (
                      <span className="truncate text-sm text-muted-foreground">
                        {u.companyName}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(u.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function SectorBars({ data }: { data: { sector: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.sector} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm">{d.sector}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-sm text-muted-foreground">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">No memory yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Upload pitch decks, memos, or notes to start building your firm&apos;s
        institutional memory — or run{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          npm run ingest:demo
        </code>{" "}
        to load the sample dataset.
      </p>
      <Link
        href="/upload"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Upload documents <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Layers className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
