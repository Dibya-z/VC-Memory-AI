/**
 * Runs the sample PAST deals in data/demo/ through the REAL ingestion pipeline
 * (extract -> structure -> chunk -> embed -> store). This is what makes the demo
 * feel real: the memory-chat and deal-analyzer features search actual embedded
 * content, not hand-written rows.
 *
 * Run: npm run ingest:demo   (needs GROQ_API_KEY + VOYAGE_API_KEY in .env)
 *
 * Note: devai-newdeal.md is intentionally NOT loaded here — it's the sample
 * input for the Deal Analyzer (Feature 3). Loading it into memory would make
 * the similarity comparison match itself.
 */

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db/prisma";
import { ingestDocument } from "@/lib/ingest/pipeline";

interface DemoDoc {
  file: string;
  mime: string;
  /** Seeds a realistic "first met" date so the memory has history. */
  metAt: string;
}

const DEMO_DIR = join(process.cwd(), "data", "demo");

const DEMO_DOCS: DemoDoc[] = [
  { file: "ledgerlite-memo.md", mime: "text/markdown", metAt: "2025-07-22" },
  { file: "cloudbrain-ai-deck.md", mime: "text/markdown", metAt: "2025-08-14" },
  { file: "codeflow-ai-memo.md", mime: "text/markdown", metAt: "2025-09-03" },
  { file: "flowai-notes.txt", mime: "text/plain", metAt: "2025-10-11" },
  { file: "vaultguard-deck.md", mime: "text/markdown", metAt: "2025-11-05" },
];

export async function ingestDemoCorpus(): Promise<void> {
  await resetData();

  for (const doc of DEMO_DOCS) {
    const buffer = await readFile(join(DEMO_DIR, doc.file));
    process.stdout.write(`  • ${doc.file} … `);
    const { intelligence } = await ingestDocument({
      buffer,
      filename: doc.file,
      mime: doc.mime,
      metAt: new Date(doc.metAt),
    });
    const decision = intelligence.decision ? `  [${intelligence.decision}]` : "";
    console.log(`✓ ${intelligence.company}${decision}`);
  }
}

/** Clear prior data so re-running gives a reproducible demo. Order respects
 *  foreign keys (chunks/messages -> documents/conversations -> companies). */
async function resetData(): Promise<void> {
  await prisma.chunk.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.company.deleteMany();
}

async function main(): Promise<void> {
  const missing = ["GROQ_API_KEY", "VOYAGE_API_KEY"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(
      `Missing ${missing.join(" and ")}. Add them to .env (see .env.example), ` +
        `then re-run \`npm run ingest:demo\`.`
    );
    process.exit(1);
  }

  console.log("Ingesting demo corpus through the real pipeline:\n");
  await ingestDemoCorpus();
  console.log(
    "\nDone — 5 past deals are now in memory. Run `npm run dev` and explore."
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\nIngest failed:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
