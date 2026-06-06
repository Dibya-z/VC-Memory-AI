/**
 * Data-access helpers. API routes and server components should go through these
 * rather than touching `prisma` directly, so JSON-field (de)serialization and
 * common filters live in one place.
 *
 * Implemented so far (Feature 1 — ingestion writes):
 *   - createDocument / updateDocument / setDocumentStatus
 *   - upsertCompanyFromExtraction(extraction)  -> ingestion writes here
 *   - saveChunks(documentId, companyId, items)
 *
 * Planned (later features): listCompanies, getCompany, getDashboardStats,
 * allChunksWithEmbeddings (feeds the local vector store).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
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
  }
) {
  return prisma.document.update({ where: { id }, data });
}

export async function setDocumentStatus(
  id: string,
  status: "processing" | "processed" | "failed",
  error?: string
) {
  return prisma.document.update({
    where: { id },
    data: { status, error: error ?? null },
  });
}

// ── Companies ────────────────────────────────────────────────────────────────

/**
 * Upsert a Company from extracted intelligence, keyed by name (the firm's
 * memory of a startup is one record, even across multiple documents). New
 * non-empty fields are merged in; existing values are never clobbered by blanks.
 */
export async function upsertCompanyFromExtraction(
  e: ExtractedIntelligence,
  opts: { metAt?: Date } = {}
) {
  const name = e.company.trim();
  const metAt = opts.metAt ?? new Date();
  const data = buildCompanyData(e);

  const existing = await prisma.company.findFirst({ where: { name } });
  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: { ...data, lastMetAt: metAt },
    });
  }
  return prisma.company.create({
    data: { name, ...data, firstMetAt: metAt, lastMetAt: metAt },
  });
}

/** Only includes fields the model actually produced, so a merge never overwrites
 *  a known value with an empty one. */
function buildCompanyData(
  e: ExtractedIntelligence
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
  if (e.strengths) d.strengths = e.strengths as unknown as Prisma.InputJsonValue;
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
  items: { content: string; ordinal: number; embedding: number[] }[]
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
          company: { select: { name: true } },
        },
      }),
    ]);

  const sectorBreakdown = sectorGroups
    .filter((g) => g.sector)
    .map((g) => ({ sector: g.sector as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const decisionBreakdown = decisionGroups
    .filter((g) => g.decision)
    .map((g) => ({ decision: g.decision as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const recentUploads = recent.map((d) => ({
    id: d.id,
    filename: d.filename,
    companyName: d.company?.name ?? null,
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

export async function listCompanies(
  filters: { sector?: string; decision?: string; stage?: string } = {}
): Promise<CompanyListItem[]> {
  const where: Prisma.CompanyWhereInput = {};
  if (filters.sector) where.sector = filters.sector;
  if (filters.decision) where.decision = filters.decision;
  if (filters.stage) where.stage = filters.stage;

  const rows = await prisma.company.findMany({
    where,
    orderBy: [{ lastMetAt: "desc" }, { createdAt: "desc" }],
    select: {
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
    },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sector: r.sector,
    stage: r.stage,
    decision: r.decision,
    oneLiner: r.oneLiner,
    lastMetAt: r.lastMetAt ? r.lastMetAt.toISOString() : null,
    strengthsCount: countArray(r.strengths),
    risksCount: countArray(r.risks),
    documentCount: r._count.documents,
  }));
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
    })),
  };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function countArray(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

// ── Health check ─────────────────────────────────────────────────────────────

export async function ping(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
