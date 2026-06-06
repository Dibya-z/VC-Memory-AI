/**
 * Database seeder. Populates the firm's memory with a realistic demo dataset so
 * the product works the moment it's opened — including PAST INVESTMENT DECISIONS
 * so the memory-comparison features have something to compare against.
 *
 * Planned demo companies (mix of sectors + decisions):
 *   - CloudBrain AI   (AI Infrastructure, Seed)   -> Passed  (unclear enterprise adoption)
 *   - CodeFlow AI     (Developer Tools, Seed)      -> Passed  (weak team adoption)
 *   - LedgerLite      (Fintech, Series A)          -> Invested
 *   - FlowAI          (SaaS, Seed)                 -> Tracking (pricing/retention concerns)
 *   - VaultGuard      (Cybersecurity, Seed)        -> Interested
 *
 * Run: npm run db:seed   (or `npm run setup` for push + seed + demo ingest)
 *
 * TODO(impl): either insert structured companies directly, or (preferred) write
 * the demo source documents to data/demo and run them through the real
 * ingestion pipeline via scripts/ingest-demo.ts so embeddings exist for search.
 */

import { prisma } from "@/lib/db/prisma";

async function main() {
  // TODO(impl): seed demo companies + documents + chunks/embeddings.
  console.log("Seed: not implemented yet. Connected to DB:", !!prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
