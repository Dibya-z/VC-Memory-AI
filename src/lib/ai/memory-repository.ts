import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MemoryCompany, MemoryFilters, MemoryRepository } from "./memory-contract";

const companySelect = {
  id: true, name: true, sector: true, decision: true, decisionReason: true,
  firstMetAt: true, lastMetAt: true, updatedAt: true,
} satisfies Prisma.CompanySelect;

type CompanyRow = Prisma.CompanyGetPayload<{ select: typeof companySelect }>;

function serializeCompany(row: CompanyRow): MemoryCompany {
  return {
    ...row,
    firstMetAt: row.firstMetAt?.toISOString() ?? null,
    lastMetAt: row.lastMetAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Typed, allowlisted current-record filters. No model string becomes a query. */
export function memoryCompanyWhere(filters: MemoryFilters): Prisma.CompanyWhereInput {
  return {
    ...(filters.sector ? { sector: { equals: filters.sector, mode: "insensitive" as const } } : {}),
    ...(filters.decision ? { decision: filters.decision } : {}),
    ...(filters.metAfter || filters.metBefore ? {
      lastMetAt: {
        ...(filters.metAfter ? { gte: new Date(filters.metAfter) } : {}),
        ...(filters.metBefore ? { lte: new Date(filters.metBefore) } : {}),
      },
    } : {}),
  };
}

export const memoryRepository: MemoryRepository = {
  async catalog() {
    return (await prisma.company.findMany({ select: companySelect, orderBy: [{ name: "asc" }, { id: "asc" }] })).map(serializeCompany);
  },
  async list(filters) {
    return (await prisma.company.findMany({ where: memoryCompanyWhere(filters), select: companySelect, orderBy: [{ name: "asc" }, { id: "asc" }] })).map(serializeCompany);
  },
  async count(filters) {
    return prisma.company.count({ where: memoryCompanyWhere(filters) });
  },
  async documents(companyIds) {
    if (!companyIds.length) return [];
    const rows = await prisma.document.findMany({
      where: { companyId: { in: companyIds }, status: "processed" },
      select: {
        id: true, companyId: true, company: { select: { name: true } }, filename: true,
        docType: true, rawText: true, createdAt: true,
        chunks: { select: { id: true, content: true, ordinal: true }, orderBy: { ordinal: "asc" } },
      },
      orderBy: [{ filename: "asc" }, { id: "asc" }],
    });
    return rows.map(({ company, createdAt, ...document }) => ({ ...document, companyName: company?.name ?? null, uploadedAt: createdAt.toISOString() }));
  },
};
