/** Portable fixture evaluation: no database, keys, embedding service or generation service. */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { answerFromMemory } from "../src/lib/ai/chat";
import { baselineCases, baselineClaims, fixtureDependencies, followupRequest, fixtureCorpusFingerprint } from "../tests/fixtures/memory";
import { assessMemoryCase, baselineComparison } from "./lib/memory-evaluation";

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--out")) throw new Error("Usage: npm run eval:memory -- [--out report.json]");
  const cases = [];
  for (const scenario of baselineCases) {
    const result = await answerFromMemory(scenario.id === "flowai_followup" ? followupRequest : { message: scenario.question }, fixtureDependencies(baselineClaims[scenario.id]));
    cases.push({ id: scenario.id, question: scenario.question, expected: scenario.expected,
      before: baselineComparison(scenario.id), ...result,
      evaluation: assessMemoryCase(scenario.id, result, "fixture") });
  }
  const report = { schemaVersion: 1, mode: "fixture", corpus: "committed-fictional-demo-documents",
    corpusFingerprint: fixtureCorpusFingerprint, configuredProviders: "scripted mocks", cases,
    limitations: ["No live generation or database testing.", "A fixture pass establishes orchestration behavior, not live LLM correctness.", "Semantic source support needs independent review; no aggregate accuracy claim."] };
  if (args[1]) await writeFile(resolve(args[1]), JSON.stringify(report, null, 2) + "\n");
  const failed = cases.filter((entry) => [entry.evaluation.correctness.status, entry.evaluation.completeness.status, entry.evaluation.groundedness.provenance, entry.evaluation.citationUsefulness.status, entry.evaluation.taskFit.status].includes("fail"));
  console.log(JSON.stringify({ mode: report.mode, cases: cases.length, passed: cases.length - failed.length, failed: failed.map((entry) => entry.id), report: args[1] ?? null }));
  if (failed.length) process.exitCode = 1;
}
main().catch(() => { console.error("Fixture evaluation failed. Run npm test for detailed diagnostics."); process.exitCode = 1; });
