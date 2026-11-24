/** Explicitly opt-in Groq smoke checks over committed fictional fixtures, without a database. */
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as pause } from "node:timers/promises";
import type { ChatResult, MemoryChatRequest } from "../src/lib/ai/chat";

const CASE_IDS = ["meeting", "facts", "followup", "unknown"] as const;
type CaseId = typeof CASE_IDS[number];
const MAX_PROVIDER_REQUESTS = 8;

const HELP = `Memory Chat real-provider smoke checks (public fictional fixtures; no database).

Usage:
  npm run eval:memory:provider -- --live --cases meeting,facts,followup,unknown \\
    --repeat 1 --pace-ms 21000 --out /tmp/memory-provider-report.json

--live       Required acknowledgement that real Groq requests may use provider quota.
--cases      Distinct case IDs: ${CASE_IDS.join(", ")} (default: all four).
--repeat     1-3 repetitions; at most eight orchestration requests in total.
--pace-ms    20000-60000 ms between orchestration requests (default: 21000).
--out        Required new .json report path; existing files are never overwritten.
--help       Show this help without loading .env, app modules, or providers.

At most eight actual generator calls are allowed, with at most two per case.
SDK transport retries are disabled. Only GROQ_API_KEY is needed; no Voyage or DB.
Reports contain fictional answers/excerpts and require human source-support review.
`;

class CommandError extends Error {}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({ options: {
      help: { type: "boolean" }, live: { type: "boolean" }, cases: { type: "string", default: CASE_IDS.join(",") },
      repeat: { type: "string", default: "1" }, "pace-ms": { type: "string", default: "21000" }, out: { type: "string" },
    }, strict: true, allowPositionals: false }));
  } catch {
    throw new CommandError("Invalid provider-smoke arguments. Run with --help.");
  }
  if (values.help) { console.log(HELP); return; }
  if (!values.live) {
    throw new CommandError("Provider smoke evaluation requires explicit --live. No environment, database, or provider was accessed. Run with --help.");
  }
  const ids = values.cases.split(",").map((id) => id.trim());
  const repetitions = Number(values.repeat), paceMs = Number(values["pace-ms"]);
  if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !CASE_IDS.includes(id as CaseId)) ||
    !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3 || ids.length * repetitions > 8 ||
    !Number.isInteger(paceMs) || paceMs < 20000 || paceMs > 60000 || !values.out?.trim() || !/\.json$/i.test(values.out)) {
    throw new CommandError("Provide distinct --cases meeting,facts,followup,unknown; --repeat 1-3; at most eight total cases; --pace-ms 20000-60000; and a new --out .json path. No provider was accessed.");
  }

  // Validate every argument before reading credentials or importing model config.
  // Dynamic imports below make .env overrides available when MODELS initializes.
  const { config } = await import("dotenv");
  config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env" });
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new CommandError("GROQ_API_KEY is required for explicitly opted-in provider smoke checks; no provider was accessed.");
  }
  // The repository override below is authoritative. These inert, process-only
  // URLs also ensure an accidental default-adapter regression cannot reach a DB.
  process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/public_fixture";
  process.env.DIRECT_URL = process.env.DATABASE_URL;

  let reportFile;
  try { reportFile = await open(resolve(values.out), "wx"); }
  catch { throw new CommandError("The report path must be writable and must not already exist; no provider was accessed."); }

  let providerRequests = 0;
  const results: Record<string, unknown>[] = [];
  const report = {
    schemaVersion: 1, mode: "public_fixture_real_provider", databaseAccessed: false, databaseWrites: 0,
    configuredModel: null as string | null, corpusFingerprint: null as string | null,
    pacingMs: paceMs, maxOrchestrationRequests: ids.length * repetitions, maxProviderRequests: MAX_PROVIDER_REQUESTS,
    providerRequests: 0, runtimeCasesPassed: 0, runtimeCasesFailed: 0, cases: results,
    limitations: [
      "Small opt-in smoke sample, not a general accuracy benchmark or a latency comparison.",
      "Status, exact source spans, and diagnostic field checks do not prove semantic entailment of every claim.",
      "Read answers and cited fictional sources to assess accuracy, completeness, qualifiers, and task fit.",
      "Only committed fictional fixtures are read; the live database is neither inspected nor modified.",
      "At most two generator calls per case and eight per run; an exhausted budget produces a failed case rather than more requests.",
    ],
    failure: null as string | null,
  };
  try {
    const [{ answerFromMemory }, { completeWithMetadata, MODELS }, fixtures, { companyRecordEvidence }] = await Promise.all([
      import("../src/lib/ai/chat"), import("../src/lib/ai/llm"), import("../tests/fixtures/memory"),
      import("../src/lib/ai/memory-evidence"),
    ]);
    report.configuredModel = MODELS.reasoning;
    report.corpusFingerprint = fixtures.fixtureCorpusFingerprint;
    const scenarios: Record<CaseId, { request: MemoryChatRequest; companyId: string | null }> = {
      meeting: { request: { message: "Prep me for a meeting with FlowAI." }, companyId: "flow" },
      facts: { request: { message: "What are LedgerLite's recorded ARR, net revenue retention, and platform customers?" }, companyId: "ledger" },
      followup: { request: fixtures.followupRequest, companyId: "flow" },
      unknown: { request: { message: "Who founded Orchid Robotics, and what is our investment decision on it?" }, companyId: null },
    };
    const companyRecords = fixtures.fixtureCompanies.map(companyRecordEvidence);
    const diagnostics = (id: CaseId, answer: string) => id === "facts"
      ? { arrMentioned: /1\.8\s*(?:m\b|million)/i.test(answer), nrrMentioned: /134\s*%/.test(answer), customersMentioned: /\b22\b/.test(answer) }
      : id === "followup" ? { foundersMentioned: /Grace\s+Lin/i.test(answer) && /Raj\s+Patel/i.test(answer), conditionsMentioned: /110\s*%|reliability|observability/i.test(answer) }
      : id === "meeting" ? { recordedPositionMentioned: /\btracking\b/i.test(answer), unknownsLabeled: /Not recorded \/ uncertain:/.test(answer), suggestionsLabeled: /Suggested diligence question:/.test(answer) }
      : { unknownCompanyMentioned: /Orchid\s+Robotics/i.test(answer) };
    const sourceChecks = (result: ChatResult, companyId: string | null) => result.citations.every((citation) => {
      if (citation.companyId !== companyId || !citation.location || !citation.quote) return false;
      const source = citation.documentId
        ? fixtures.fixtureDocuments.find((item) => item.id === citation.documentId && item.companyId === companyId)?.rawText
        : companyRecords.find((item) => item.companyId === companyId)?.text;
      return source !== undefined && source.slice(citation.location.start, citation.location.end) === citation.quote;
    });

    for (let repetition = 1; repetition <= repetitions; repetition++) {
      for (const name of ids) {
        const id = name as CaseId;
        if (results.length) await pause(paceMs);
        const scenario = scenarios[id];
        let caseProviderRequests = 0;
        const result = await answerFromMemory(scenario.request, {
          repository: fixtures.fixtureRepository(),
          embed: async () => { throw new Error("Public named-fixture smoke checks must not call embeddings"); },
          search: async () => { throw new Error("Public named-fixture smoke checks must not call vector search"); },
          generate: async (prompt, options) => {
            if (caseProviderRequests >= 2 || providerRequests >= MAX_PROVIDER_REQUESTS) {
              throw new Error("Provider smoke request budget exhausted");
            }
            caseProviderRequests++; providerRequests++;
            // This is the real application's generator, with no scripted answer.
            return completeWithMetadata(prompt, { ...options, maxRetries: 0 });
          },
        });
        const diagnosticContent = diagnostics(id, result.answer);
        const checks = {
          expectedStatus: result.status === (id === "unknown" ? "insufficient_evidence" : "complete"),
          correctCompanyScope: id === "unknown" ? !!result.trace.plan.unknownCompany
            : result.trace.plan.companyIds.length === 1 && result.trace.plan.companyIds[0] === scenario.companyId,
          canonicalSourceQuotes: sourceChecks(result, scenario.companyId),
          citationsPresentWhenExpected: id === "unknown" ? result.citations.length === 0 : result.citations.some((citation) => !!citation.documentId),
          expectedProviderBehavior: id === "unknown" ? caseProviderRequests === 0 : caseProviderRequests >= 1 && caseProviderRequests <= 2,
          expectedFieldsPresent: Object.values(diagnosticContent).every(Boolean),
        };
        const passed = Object.values(checks).every(Boolean);
        report[passed ? "runtimeCasesPassed" : "runtimeCasesFailed"]++;
        results.push({ id, repetition, request: scenario.request, providerRequests: caseProviderRequests,
          ...result, checks, runtimeContractPassed: passed, diagnosticContent,
          humanSourceSupportReviewRequired: true });
        console.log(JSON.stringify({ id, repetition, status: result.status, runtimeContractPassed: passed,
          providerRequests: caseProviderRequests, elapsedMs: result.trace.elapsedMs }));
      }
    }
  } catch {
    // Native errors can include credentials, source text, or request details.
    report.failure = "Provider smoke checks could not finish; sensitive details were withheld.";
    process.exitCode = 1;
  } finally {
    report.providerRequests = providerRequests;
    try { await reportFile.writeFile(JSON.stringify(report, null, 2) + "\n"); }
    finally { await reportFile.close(); }
  }
  if (report.runtimeCasesFailed) process.exitCode = 1;
  console.log(JSON.stringify({ report: resolve(values.out), providerRequests, databaseAccessed: false,
    runtimeCasesPassed: report.runtimeCasesPassed, runtimeCasesFailed: report.runtimeCasesFailed }));
}

main().catch((error: unknown) => {
  console.error(error instanceof CommandError ? error.message : "Provider smoke evaluation failed; sensitive details were withheld.");
  process.exitCode = 1;
});
