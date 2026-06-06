/**
 * Data-access helpers. API routes and server components should go through these
 * rather than touching `prisma` directly, so JSON-field (de)serialization and
 * common filters live in one place.
 *
 * TODO(impl): flesh out during the build phase. Planned helpers:
 *   - listCompanies({ sector, decision, stage })   -> Company list page + filters
 *   - getCompany(id)                                -> Company detail page
 *   - getDashboardStats()                           -> Dashboard
 *   - upsertCompanyFromExtraction(extraction, doc)  -> ingestion writes here
 *   - createDocument / setDocumentStatus
 *   - allChunksWithEmbeddings()                     -> feeds the local vector store
 */

import { prisma } from "@/lib/db/prisma";

export { prisma };

// Placeholder export so this module is importable while features are built out.
export async function ping(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
