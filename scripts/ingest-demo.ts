/**
 * Runs every sample document in data/demo/ through the REAL ingestion pipeline
 * (extract -> structure -> chunk -> embed -> store). This is what makes the demo
 * feel real: the memory-chat and deal-analyzer features search actual embedded
 * content, not hand-written rows.
 *
 * Run: npm run ingest:demo   (needs ANTHROPIC_API_KEY + VOYAGE_API_KEY)
 *
 * TODO(impl): read files from data/demo, call lib/ingest/pipeline.ingestDocument
 * for each, log a summary of companies created.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DEMO_DIR = join(process.cwd(), "data", "demo");

async function main() {
  const files = await readdir(DEMO_DIR).catch(() => []);
  console.log(
    `Demo ingest: not implemented yet. Found ${files.length} file(s) in data/demo.`
  );
  // TODO(impl): for each file -> ingestDocument({ buffer, filename, mime }).
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
