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
import type { ExtractedIntelligence } from "@/lib/types";

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

// ── Health check ─────────────────────────────────────────────────────────────

export async function ping(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
