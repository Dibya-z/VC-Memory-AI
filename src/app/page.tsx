/**
 * Dashboard. Editorial header in the "confident restraint" language, with a
 * clean hairline-card layout below for the stats, breakdowns, and recent
 * uploads. Reads the query layer directly.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { MemoryGraphic } from "@/components/dashboard/MemoryGraphic";
import { DecisionBadge } from "@/components/ui/badges";
import { getDashboardStats } from "@/lib/db/queries";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-12 pb-12">
      {/* Editorial header — text left, knowledge-graph panel right */}
      <header className="grid items-stretch gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
        <div className="flex max-w-[620px] flex-col justify-center">
          <p className="label-eyebrow">Institutional Memory · Overview</p>
          <h1 className="mt-6 font-serif text-6xl font-normal leading-[1.05] tracking-tight">
            The firm&apos;s memory,
            <br />
            at a glance.
          </h1>
          <p className="mt-8 max-w-[520px] text-[18px] leading-relaxed text-muted-foreground">
            Every decision, concern, and conversation the team has had — kept,
            structured, and searchable.
          </p>
        </div>
        <div className="hidden items-center justify-end lg:flex">
          <MemoryGraphic />
        </div>
      </header>

      {stats.companyCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid gap-5 sm:grid-cols-3">
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

          {/* Breakdowns */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel label="By decision">
              {stats.decisionBreakdown.length === 0 ? (
                <Muted>No decisions recorded yet.</Muted>
              ) : (
                <ul>
                  {stats.decisionBreakdown.map((d) => (
                    <li
                      key={d.decision}
                      className="flex items-center justify-between border-b border-border py-3 last:border-0"
                    >
                      <DecisionBadge decision={d.decision} />
                      <span className="text-[18px] font-light tabular-nums">
                        {d.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel label="By sector">
              {stats.sectorBreakdown.length === 0 ? (
                <Muted>No sectors yet.</Muted>
              ) : (
                <SectorBars data={stats.sectorBreakdown} />
              )}
            </Panel>
          </div>

          {/* Recent uploads */}
          <Panel label="Recent uploads">
            {stats.recentUploads.length === 0 ? (
              <Muted>Nothing uploaded yet.</Muted>
            ) : (
              <ul>
                {stats.recentUploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-4 border-b border-border py-3 last:border-0"
                  >
                    <span className="flex-1 truncate text-[15px]">
                      {u.filename}
                    </span>
                    {u.companyName && (
                      <span className="hidden truncate text-[15px] text-muted-foreground sm:block">
                        {u.companyName}
                      </span>
                    )}
                    <span className="label-eyebrow shrink-0">
                      {timeAgo(u.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function SectorBars({ data }: { data: { sector: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.sector} className="flex items-center gap-4">
          <span className="w-36 shrink-0 truncate text-[14px]">{d.sector}</span>
          <div className="h-1.5 flex-1 bg-muted">
            <div
              className="h-1.5 bg-accent"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-[14px] font-light tabular-nums">
            {d.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <section className="max-w-[680px] border-t border-border pt-12">
      <h2 className="font-serif text-3xl font-normal tracking-tight">
        No memory yet
      </h2>
      <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
        Upload pitch decks, memos, or notes to start building your firm&apos;s
        institutional memory — or run{" "}
        <code className="bg-secondary px-1.5 py-0.5 text-[13px]">
          npm run ingest:demo
        </code>{" "}
        to load the sample dataset.
      </p>
      <Link
        href="/upload"
        className="group mt-8 inline-flex h-12 items-center gap-2 bg-primary px-8 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Upload documents
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.5}
        />
      </Link>
    </section>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="label-eyebrow mb-5">{label}</h2>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-muted-foreground">{children}</p>;
}
