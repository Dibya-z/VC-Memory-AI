/**
 * Data-access helpers. API routes and server components should go through these
 * rather than touching `prisma` directly, so JSON-field (de)serialization and
 * common filters live in one place.
 *
 * Ingestion writes:
 *   - createDocument / updateDocument / setDocumentStatus
 *   - upsertCompanyFromExtraction(extraction)  -> ingestion writes here
 *   - saveChunks(documentId, companyId, items)
 *
 * Dashboard/company reads and local vector candidates live below. Memory Chat
 * has its own typed, read-only adapter in lib/ai/memory-repository.ts.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  COMPANY_PAGE_SIZE,
  UNRECORDED_FILTER,
  mergeCompanyGroups,
  type CompanyDirectoryOptions,
  type CompanyFacets,
} from "@/lib/company-discovery";
import type {
  CompanyDetail,
  CompanyListItem,
  DashboardStats,
  ExtractedIntelligence,
  Founder,
} from "@/lib/types";

export { prisma };

// ── Documents ────────────────────────────────────────────────────────────────

export async function createDocument(input: {
  filename: string;
  fileType: string;
  rawText: string;
  sizeBytes?: number;
  status?: string;
  companyId?: string;
  docType?: string;
}) {
  return prisma.document.create({
    data: {
      filename: input.filename,
      fileType: input.fileType,
      rawText: input.rawText,
      sizeBytes: input.sizeBytes,
      status: input.status ?? "processing",
      companyId: input.companyId,
      docType: input.docType,
    },
  });
}

export async function updateDocument(
  id: string,
  data: {
    companyId?: string;
    docType?: string | null;
    status?: string;
    error?: string | null;
    intelligence?: ExtractedIntelligence;
  },
) {
  const { intelligence, ...rest } = data;
  return prisma.document.update({
    where: { id },
    data: {
      ...rest,
      ...(intelligence !== undefined
        ? { intelligence: intelligence as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
}

export async function setDocumentStatus(
  id: string,
  status: "processing" | "processed" | "failed",
  error?: string,
) {
  return prisma.document.update({
    where: { id },
    data: { status, error: error ?? null },
  });
}

// ── Companies ────────────────────────────────────────────────────────────────

/**
 * Upsert a Company from extracted intelligence, keyed by name (the firm's
 * memory of a startup is one record, even across multiple documents).
 *
 * Merge policy so memory ACCUMULATES across a deck + memo + notes:
 *   - Scalars (problem, traction, decision, …): refreshed only when the new
 *     document actually has a value; an empty field never clobbers a known one.
 *   - Arrays (founders, strengths, risks, concerns): UNION-ed across documents
 *     and de-duplicated, so nothing any document said is lost.
 * Matching is case-insensitive and collapses repeated whitespace, so names
 * such as "Nimbus Health" and "nimbus   health" resolve to one memory.
 */
export async function upsertCompanyFromExtraction(
  e: ExtractedIntelligence,
  opts: { metAt?: Date; db?: Prisma.TransactionClient } = {},
) {
  const db = opts.db ?? prisma;
  const name = e.company.trim();
  const metAt = opts.metAt ?? new Date();

  // Preserve whitespace-normalized name matching across document uploads.
  // Comparing in JS is adequate at this prototype's corpus scale.
  const all = await db.company.findMany();
  const existing = all.find(
    (c) => normalizeCompanyName(c.name) === normalizeCompanyName(name),
  );

  if (existing) {
    const data: Prisma.CompanyUncheckedUpdateInput = { lastMetAt: metAt };
    if (e.sector) data.sector = e.sector;
    if (e.stage) data.stage = e.stage;
    if (e.oneLiner) data.oneLiner = e.oneLiner;
    if (e.problem) data.problem = e.problem;
    if (e.solution) data.solution = e.solution;
    if (e.businessModel) data.businessModel = e.businessModel;
    if (e.market) data.market = e.market;
    if (e.traction) data.traction = e.traction;
    if (e.competition) data.competition = e.competition;
    if (e.decision) data.decision = e.decision;
    if (e.decisionReason) data.decisionReason = e.decisionReason;
    data.founders = unionFounders(
      existing.founders,
      e.founders,
    ) as unknown as Prisma.InputJsonValue;
    data.strengths = unionStrings(
      existing.strengths,
      e.strengths,
    ) as unknown as Prisma.InputJsonValue;
    data.risks = unionStrings(
      existing.risks,
      e.risks,
    ) as unknown as Prisma.InputJsonValue;
    data.concerns = unionStrings(
      existing.concerns,
      e.concerns,
    ) as unknown as Prisma.InputJsonValue;
    return db.company.update({ where: { id: existing.id }, data });
  }

  return db.company.create({
    data: { name, ...buildCompanyData(e), firstMetAt: metAt, lastMetAt: metAt },
  });
}

export function normalizeCompanyName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Merge two string lists, trimmed and de-duplicated case-insensitively. */
function unionStrings(existing: unknown, incoming?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [
    ...(Array.isArray(existing) ? existing : []),
    ...(incoming ?? []),
  ]) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/** Merge founder lists by name, filling missing role/background from later mentions. */
function unionFounders(existing: unknown, incoming?: Founder[]): Founder[] {
  const byKey = new Map<string, Founder>();
  const add = (f: unknown) => {
    if (!f || typeof f !== "object") return;
    const rec = f as Founder;
    const name = (rec.name ?? "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    const prev = byKey.get(key);
    byKey.set(key, {
      name: prev?.name ?? name,
      role: prev?.role ?? rec.role,
      background: prev?.background ?? rec.background,
    });
  };
  (Array.isArray(existing) ? existing : []).forEach(add);
  (incoming ?? []).forEach(add);
  return [...byKey.values()];
}

/** Only includes fields the model actually produced, so a merge never overwrites
 *  a known value with an empty one. */
function buildCompanyData(
  e: ExtractedIntelligence,
): Omit<Prisma.CompanyUncheckedCreateInput, "name"> {
  const d: Omit<Prisma.CompanyUncheckedCreateInput, "name"> = {};
  if (e.sector) d.sector = e.sector;
  if (e.stage) d.stage = e.stage;
  if (e.oneLiner) d.oneLiner = e.oneLiner;
  if (e.problem) d.problem = e.problem;
  if (e.solution) d.solution = e.solution;
  if (e.businessModel) d.businessModel = e.businessModel;
  if (e.market) d.market = e.market;
  if (e.traction) d.traction = e.traction;
  if (e.competition) d.competition = e.competition;
  if (e.founders) d.founders = e.founders as unknown as Prisma.InputJsonValue;
  if (e.strengths)
    d.strengths = e.strengths as unknown as Prisma.InputJsonValue;
  if (e.risks) d.risks = e.risks as unknown as Prisma.InputJsonValue;
  if (e.concerns) d.concerns = e.concerns as unknown as Prisma.InputJsonValue;
  if (e.decision) d.decision = e.decision;
  if (e.decisionReason) d.decisionReason = e.decisionReason;
  return d;
}

// ── Chunks ───────────────────────────────────────────────────────────────────

export async function saveChunks(
  documentId: string,
  companyId: string | null,
  items: { content: string; ordinal: number; embedding: number[] }[],
) {
  if (!items.length) return;
  await prisma.chunk.createMany({
    data: items.map((c) => ({
      documentId,
      companyId,
      content: c.content,
      ordinal: c.ordinal,
      embedding: c.embedding as unknown as Prisma.InputJsonValue,
    })),
  });
}

// ── Reads (Step 3 — dashboard + company memory) ──────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [companyCount, documentCount, sectorGroups, decisionGroups, recent] =
    await Promise.all([
      prisma.company.count(),
      prisma.document.count(),
      prisma.company.groupBy({ by: ["sector"], _count: { _all: true } }),
      prisma.company.groupBy({ by: ["decision"], _count: { _all: true } }),
      prisma.document.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          filename: true,
          createdAt: true,
          company: { select: { id: true, name: true } },
        },
      }),
    ]);

  const sectorBreakdown = mergeCompanyGroups(
    sectorGroups.map((g) => ({ value: g.sector, count: g._count._all })),
  ).map((group) => ({ sector: group.value, count: group.count }));
  const decisionBreakdown = mergeCompanyGroups(
    decisionGroups.map((g) => ({ value: g.decision, count: g._count._all })),
  ).map((group) => ({ decision: group.value, count: group.count }));

  const recentUploads = recent.map((d) => ({
    id: d.id,
    filename: d.filename,
    companyName: d.company?.name ?? null,
    companyId: d.company?.id ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  return {
    companyCount,
    documentCount,
    sectorBreakdown,
    decisionBreakdown,
    recentUploads,
  };
}

function companyWhere(
  filters: CompanyDirectoryOptions,
): Prisma.CompanyWhereInput {
  const clauses: Prisma.CompanyWhereInput[] = [];
  for (const key of ["sector", "decision", "stage"] as const) {
    const value = filters[key];
    if (value === UNRECORDED_FILTER)
      clauses.push({ OR: [{ [key]: null }, { [key]: "" }] });
    else if (value)
      clauses.push({ [key]: { equals: value, mode: "insensitive" } });
  }
  if (filters.q)
    clauses.push({ name: { contains: filters.q, mode: "insensitive" } });
  return clauses.length ? { AND: clauses } : {};
}

const companyListSelect = {
  id: true,
  name: true,
  sector: true,
  stage: true,
  decision: true,
  oneLiner: true,
  lastMetAt: true,
  strengths: true,
  risks: true,
  _count: { select: { documents: true } },
} satisfies Prisma.CompanySelect;

type CompanyListRow = Prisma.CompanyGetPayload<{
  select: typeof companyListSelect;
}>;
function companyListItem(r: CompanyListRow): CompanyListItem {
  return {
    id: r.id,
    name: r.name,
    sector: r.sector,
    stage: r.stage,
    decision: r.decision,
    oneLiner: r.oneLiner,
    lastMetAt: r.lastMetAt?.toISOString() ?? null,
    strengthsCount: countArray(r.strengths),
    risksCount: countArray(r.risks),
    documentCount: r._count.documents,
  };
}

/** Compatibility list endpoint is bounded; the directory uses explicit pagination. */
export async function listCompanies(
  filters: CompanyDirectoryOptions = {},
): Promise<CompanyListItem[]> {
  const rows = await prisma.company.findMany({
    where: companyWhere(filters),
    take: 100,
    orderBy: [{ lastMetAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: companyListSelect,
  });
  return rows.map(companyListItem);
}

/** Facets describe the whole memory, independently of the active filter/page. */
export async function getCompanyFacets(): Promise<CompanyFacets> {
  const [sectors, decisions, stages] = await Promise.all([
    prisma.company.groupBy({ by: ["sector"] }),
    prisma.company.groupBy({ by: ["decision"] }),
    prisma.company.groupBy({ by: ["stage"] }),
  ]);
  function options(values: (string | null)[]) {
    const unique = new Map<string, { value: string; label: string }>();
    for (const value of values) {
      if (!value)
        unique.set(UNRECORDED_FILTER, {
          value: UNRECORDED_FILTER,
          label: "Not recorded",
        });
      else {
        const key = value.toLocaleLowerCase("en");
        if (!unique.has(key)) unique.set(key, { value, label: value });
      }
    }
    return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
  }
  return {
    sectors: options(sectors.map((g) => g.sector)),
    decisions: options(decisions.map((g) => g.decision)),
    stages: options(stages.map((g) => g.stage)),
  };
}

export async function searchCompanies(options: CompanyDirectoryOptions = {}) {
  const where = companyWhere(options);
  const [total, facets] = await Promise.all([
    prisma.company.count({ where }),
    getCompanyFacets(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);
  const orderBy: Prisma.CompanyOrderByWithRelationInput[] =
    options.sort === "name-asc"
      ? [{ name: "asc" }, { id: "asc" }]
      : options.sort === "name-desc"
        ? [{ name: "desc" }, { id: "asc" }]
        : [
            { lastMetAt: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
            { id: "asc" },
          ];
  const rows = await prisma.company.findMany({
    where,
    select: companyListSelect,
    orderBy,
    skip: (page - 1) * COMPANY_PAGE_SIZE,
    take: COMPANY_PAGE_SIZE,
  });
  return {
    companies: rows.map(companyListItem),
    total,
    page,
    pageSize: COMPANY_PAGE_SIZE,
    pageCount,
    facets,
  };
}

/** Never return a document through a different company's URL. */
export async function getCompanyDocument(
  companyId: string,
  documentId: string,
) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId },
    select: {
      id: true,
      filename: true,
      rawText: true,
      docType: true,
      createdAt: true,
      company: { select: { id: true, name: true } },
    },
  });
  if (!document || !document.company) return null;
  return {
    ...document,
    company: document.company,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function getCompanyIdentity(id: string) {
  return prisma.company.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
}

export async function getCompanyDocumentIdentity(
  companyId: string,
  documentId: string,
) {
  return prisma.document.findFirst({
    where: { id: documentId, companyId },
    select: { filename: true, company: { select: { name: true } } },
  });
}

export async function getCompany(id: string): Promise<CompanyDetail | null> {
  const c = await prisma.company.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          fileType: true,
          docType: true,
          createdAt: true,
          intelligence: true,
        },
      },
    },
  });
  if (!c) return null;

  return {
    id: c.id,
    name: c.name,
    sector: c.sector,
    stage: c.stage,
    oneLiner: c.oneLiner,
    problem: c.problem,
    solution: c.solution,
    businessModel: c.businessModel,
    market: c.market,
    traction: c.traction,
    competition: c.competition,
    founders: asArray<Founder>(c.founders),
    strengths: asArray<string>(c.strengths),
    risks: asArray<string>(c.risks),
    concerns: asArray<string>(c.concerns),
    decision: c.decision,
    decisionReason: c.decisionReason,
    firstMetAt: c.firstMetAt ? c.firstMetAt.toISOString() : null,
    lastMetAt: c.lastMetAt ? c.lastMetAt.toISOString() : null,
    documents: c.documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      fileType: d.fileType,
      docType: d.docType,
      createdAt: d.createdAt.toISOString(),
      intelligence:
        (d.intelligence as ExtractedIntelligence | null) ?? undefined,
    })),
  };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function countArray(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/** Minimal company records for the deal analyzer's "similar past deals". */
export async function getCompaniesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.company.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      sector: true,
      decision: true,
      decisionReason: true,
    },
  });
}

// ── Vector search support ────────────────────────────────────────────────────

/** Load candidate chunks (with embeddings + company name) for the local vector
 *  store, applying company include/exclude filters at the DB level. */
export async function loadSearchChunks(
  opts: {
    companyId?: string;
    excludeCompanyId?: string;
  } = {},
) {
  const where: Prisma.ChunkWhereInput = {};
  if (opts.companyId) where.companyId = opts.companyId;
  if (opts.excludeCompanyId) where.companyId = { not: opts.excludeCompanyId };

  return prisma.chunk.findMany({
    where,
    select: {
      id: true,
      documentId: true,
      companyId: true,
      content: true,
      embedding: true,
      company: { select: { name: true } },
    },
  });
}

// ── Health check ─────────────────────────────────────────────────────────────

export async function ping(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
