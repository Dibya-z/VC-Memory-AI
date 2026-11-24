/** Opt-in, read-only live evaluation. Never seeds, resets, migrates, or writes database rows. */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as pause } from "node:timers/promises";
import { databaseFingerprint, identifyDatabaseTarget, corpusFingerprint } from "./lib/memory-live-safety";
import { baselineCases, fixtureCorpusFingerprint, followupRequest } from "../tests/fixtures/memory";
import { assessMemoryCase, baselineComparison } from "./lib/memory-evaluation";

async function main() {
  const { values } = parseArgs({ options: {
    "inspect-target": { type: "boolean" }, "inspect-corpus": { type: "boolean" },
    target: { type: "string" }, "database-fingerprint": { type: "string" },
    "corpus-fingerprint": { type: "string" }, cases: { type: "string" },
    repeat: { type: "string", default: "1" }, "pace-ms": { type: "string", default: "21000" }, out: { type: "string" },
  }, strict: true });
  if (values["inspect-target"]) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for offline target fingerprinting.");
    console.log(JSON.stringify({ databaseFingerprint: databaseFingerprint(process.env.DATABASE_URL), databaseAccessed: false }));
    return;
  }
  // Before importing the database adapter or making any connection, require the
  // verified isolated target and explicit command-line identity acknowledgement.
  const target = identifyDatabaseTarget(process.env);
  if (values.target !== target.label || values["database-fingerprint"] !== target.fingerprint) {
    throw new Error("Explicit --target and --database-fingerprint must match the verified development target.");
  }
  const repetitions = Number(values.repeat), paceMs = Number(values["pace-ms"]);
  const ids = values.cases?.split(",").filter(Boolean) ?? [];
  if (!values["inspect-corpus"] && (!ids.length || ids.length > 5 || new Set(ids).size !== ids.length ||
    ids.some((id) => !baselineCases.some((scenario) => scenario.id === id)) ||
    !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 2 ||
    !Number.isInteger(paceMs) || paceMs < 20000 || paceMs > 60000 || !values.out ||
    values["corpus-fingerprint"] !== fixtureCorpusFingerprint)) {
    throw new Error("Provide 1–5 known --cases, --repeat 1–2, --pace-ms 20000–60000, --out, and the committed fictional --corpus-fingerprint. See docs/MEMORY_CHAT.md.");
  }
  const { memoryRepository } = await import("../src/lib/ai/memory-repository");
  const { prisma } = await import("../src/lib/db/prisma");
  try {
    const companies = await memoryRepository.catalog();
    const documents = await memoryRepository.documents(companies.map((company) => company.id));
    const totalDocuments = await prisma.document.count();
    const actualFingerprint = corpusFingerprint(documents);
    const corpus = { fingerprint: actualFingerprint, companies: companies.length, documents: documents.length,
      totalDocuments, chunks: documents.reduce((count, doc) => count + doc.chunks.length, 0) };
    if (values["inspect-corpus"]) {
      console.log(JSON.stringify({ target, corpus, providerRequests: 0, databaseWrites: 0 }));
      return;
    }
    if (actualFingerprint !== values["corpus-fingerprint"] || totalDocuments !== documents.length) {
      throw new Error("The database corpus does not exactly match the acknowledged fictional corpus. No provider requests were made.");
    }
    if (!process.env.GROQ_API_KEY || !process.env.VOYAGE_API_KEY) throw new Error("Configured provider credentials are required for live evaluation; none are printed.");
    const { answerFromMemory } = await import("../src/lib/ai/chat");
    const results = [];
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      for (const id of ids) {
        if (results.length) await pause(paceMs);
        const scenario = baselineCases.find((entry) => entry.id === id)!;
        const result = await answerFromMemory(id === "flowai_followup" ? followupRequest : { message: scenario.question });
        results.push({ id, repetition, question: scenario.question, expected: scenario.expected,
          before: baselineComparison(id), ...result, evaluation: assessMemoryCase(id, result, "live") });
        console.log(JSON.stringify({ id, repetition, status: result.status, elapsedMs: result.trace.elapsedMs }));
      }
    }
    await writeFile(resolve(values.out!), JSON.stringify({ schemaVersion: 1, mode: "live", target, corpus,
      pacingMs: paceMs, maxOrchestrationRequests: ids.length * repetitions, databaseWrites: 0, cases: results,
      limitations: ["Field regex checks and exact-source provenance require source-based human review for meaning.",
        "Small selected sample; no statistical general-accuracy claim.", "Per-case latency measures orchestration only; corpus guard time is excluded.",
        "Provider SDK transport retries may add HTTP attempts within each bounded orchestration call."] }, null, 2) + "\n");
  } finally { await prisma.$disconnect(); }
}
main().catch((error: unknown) => {
  // Guard messages contain no URLs, keys or retained content. Provider/DB errors
  // are deliberately replaced because their native messages can contain secrets.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(?:Live evaluation requires|MEMORY_CHAT_TARGET_LABEL|Both DATABASE_URL|Pooled and direct|The current database target|Explicit --target|Provide 1–5|The database corpus|Configured provider credentials|DATABASE_URL is required|A valid PostgreSQL|The database URL)/.test(message);
  console.error(safe ? message : "Live evaluation failed; database/provider details were withheld.");
  process.exitCode = 1;
});
