/**
 * Dashboard. Editorial header in the "confident restraint" language, with a
 * clean hairline-card layout below for the stats, breakdowns, and recent
 * uploads. Reads the query layer directly.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { MemoryGraphic } from "@/components/dashboard/MemoryGraphic";
import { DecisionBadge } from "@/components/ui/badges";
import { getDashboardStats } from "@/lib/db/queries";
import { DateTime } from "@/components/ui/DateTime";
import { UNRECORDED_FILTER } from "@/lib/company-discovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-12 pb-12">
      {/* Editorial header — text left, knowledge-graph panel right */}
      <header className="grid items-stretch gap-12 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex max-w-[620px] flex-col justify-center">
          <p className="label-eyebrow">Institutional Memory · Overview</p>
          <h1 className="mt-6 font-serif text-4xl font-normal leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            The firm&apos;s memory,
            <br />
            at a glance.
          </h1>
          <p className="mt-8 max-w-[520px] text-[18px] leading-relaxed text-muted-foreground">
            Every deck, memo, and conversation the team has had — kept as
            structured, searchable memory. Ask it what you concluded, what you
            passed on, and why.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="group inline-flex min-h-11 items-center justify-center gap-2 py-2 bg-primary px-6 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ask the firm&apos;s memory
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </Link>
            <Link
              href="/analyzer"
              className="inline-flex min-h-11 items-center justify-center gap-2 py-2 border border-border px-6 text-[14px] font-medium transition-colors hover:border-foreground/40 hover:bg-secondary"
            >
              Analyze a new deal
            </Link>
          </div>
        </div>
        <div className="hidden min-w-0 items-center justify-end xl:flex">
          <MemoryGraphic />
        </div>
      </header>

      <Suspense fallback={<DashboardLoading />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}

async function DashboardData() {
  const stats = await getDashboardStats();
  return stats.companyCount === 0 ? (
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
          value={
            stats.sectorBreakdown.filter(
              (group) => group.sector !== "Not recorded",
            ).length
          }
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
                  <Link
                    href={`/companies?decision=${encodeURIComponent(d.decision === "Not recorded" ? UNRECORDED_FILTER : d.decision)}`}
                    className="text-link inline-flex min-h-11 items-center"
                  >
                    <DecisionBadge decision={d.decision} />
                  </Link>
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
                className="flex min-w-0 flex-col items-start gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4"
              >
                {u.companyId ? (
                  <Link
                    href={`/companies/${encodeURIComponent(u.companyId)}/documents/${encodeURIComponent(u.id)}`}
                    className="text-link min-w-0 w-full flex-1 [overflow-wrap:anywhere] text-[0.9375rem] sm:w-auto"
                  >
                    {u.filename}
                  </Link>
                ) : (
                  <span className="min-w-0 w-full flex-1 [overflow-wrap:anywhere] text-[0.9375rem] sm:w-auto">
                    {u.filename}
                  </span>
                )}
                {u.companyName &&
                  (u.companyId ? (
                    <Link
                      href={`/companies/${encodeURIComponent(u.companyId)}`}
                      className="text-link hidden min-w-0 text-sm sm:block"
                    >
                      {u.companyName}
                    </Link>
                  ) : (
                    <span className="hidden min-w-0 text-sm text-muted-foreground sm:block">
                      {u.companyName}
                    </span>
                  ))}
                <span className="label-eyebrow shrink-0">
                  <DateTime value={u.createdAt} label="Uploaded" relative />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function DashboardLoading() {
  return (
    <section
      aria-label="Loading dashboard data"
      aria-busy="true"
      className="space-y-5"
    >
      <p role="status" className="text-sm text-muted-foreground">
        Loading company memory…
      </p>
      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="h-36 border border-border bg-secondary motion-safe:animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}

function SectorBars({ data }: { data: { sector: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.sector} className="flex items-center gap-4">
          <Link
            href={`/companies?sector=${encodeURIComponent(d.sector === "Not recorded" ? UNRECORDED_FILTER : d.sector)}`}
            className="text-link min-w-0 flex-1 [overflow-wrap:anywhere] text-sm"
          >
            {d.sector}
          </Link>
          <div className="h-1.5 w-20 shrink-0 bg-muted" aria-hidden="true">
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
        institutional memory. You can also choose a fictional sample on the
        upload page.
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
