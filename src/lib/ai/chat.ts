/** Memory Chat: validated planning, exact reads, scoped evidence, verified provenance. */
import { completeWithMetadata, MODELS } from "@/lib/ai/llm";
import { buildMemoryChatPrompt, CHAT_SYSTEM } from "@/lib/ai/prompts";
import { planMemoryQuery } from "@/lib/ai/memory-plan";
import { memoryRepository } from "@/lib/ai/memory-repository";
import { companyRecordEvidence, selectMemoryEvidence } from "@/lib/ai/memory-evidence";
import { validateMemoryAnswer } from "@/lib/ai/memory-citations";
import { chatRequestSchema } from "@/lib/validators";
import { embedOne } from "@/lib/embeddings";
import { vectorStore } from "@/lib/vector/local-store";
import type { Citation } from "@/lib/types";
import type { MemoryRepository, QueryPlan } from "@/lib/ai/memory-contract";
import type { VectorStore } from "@/lib/vector/store";

export interface MemoryChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  activeCompanyId?: string;
}

export interface ChatTrace {
  plan: QueryPlan;
  evidenceIds: string[];
  evidenceSufficiency?: { sufficient: boolean; reason: string; omittedDocuments: number };
  generation?: {
    configuredModel: string;
    returnedModel: string | null;
    finishReason: string | null;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  };
  exactQuery?: { operation: "list" | "count"; rowCount: number };
  elapsedMs: number;
}

export interface ChatResult {
  answer: string;
  citations: Citation[];
  activeCompanyId: string | null;
  status: "complete" | "clarification" | "insufficient_evidence" | "incomplete" | "provider_error" | "invalid_response";
  trace: ChatTrace;
}

/** The same orchestration runs in the API and fixture/live evaluations. */
export interface MemoryChatDependencies {
  repository: MemoryRepository;
  embed: (question: string) => Promise<number[]>;
  search: VectorStore["search"];
  generate: typeof completeWithMetadata;
  now: () => number;
}

const defaults: MemoryChatDependencies = {
  repository: memoryRepository,
  embed: (question) => embedOne(question, "query"),
  search: (embedding, options) => vectorStore.search(embedding, options),
  generate: completeWithMetadata,
  now: Date.now,
};

export async function answerFromMemory(
  input: string | MemoryChatRequest,
  overrides: Partial<MemoryChatDependencies> = {}
): Promise<ChatResult> {
  const request = chatRequestSchema.parse(typeof input === "string" ? { message: input } : input);
  const deps = { ...defaults, ...overrides };
  const started = deps.now();
  const catalog = await deps.repository.catalog();
  const plan = planMemoryQuery(request, catalog);
  const trace: ChatTrace = { plan, evidenceIds: [], elapsedMs: 0 };
  const finish = (answer: string, status: ChatResult["status"], citations: Citation[] = []): ChatResult => ({
    answer, status, citations,
    activeCompanyId: !plan.unknownCompany && trace.plan.companyIds.length === 1 ? trace.plan.companyIds[0] : null,
    trace: { ...trace, elapsedMs: deps.now() - started },
  });

  if (plan.intent === "clarification") {
    return finish(plan.clarification ?? "Which company or recorded filter do you mean?", "clarification");
  }
  if (plan.unknownCompany) {
    return finish(`I couldn't find a company record for ${plan.unknownCompany} in memory. Its founders and investment decision are not recorded here.`, "insufficient_evidence");
  }

  // Exhaustive results come from typed current-record reads, never vector top-K or a model.
  if (["inventory", "count", "filtered_list"].includes(plan.intent)) {
    if (plan.intent === "count") {
      const count = await deps.repository.count(plan.filters);
      trace.exactQuery = { operation: "count", rowCount: count };
      return finish(`Total companies${Object.keys(plan.filters).length ? " matching the recorded filters" : " in memory"}: ${count}.`, "complete");
    }
    const rows = await deps.repository.list(plan.filters);
    const reasons = /\bwhy\b|reasons?/i.test(request.message);
    const records = rows.map(companyRecordEvidence);
    trace.evidenceIds = records.map((record) => record.id);
    trace.exactQuery = { operation: "list", rowCount: rows.length };
    const lines = rows.map((company) => `• ${company.name}: ${company.decision ?? "not recorded"}${reasons && company.decisionReason ? ` — ${company.decisionReason}` : ""}. [company:${company.id}]`);
    const citations: Citation[] = records.map((record) => {
      const quote = record.text.split("\n").slice(0, reasons ? 3 : 2).join("\n");
      return {
        companyId: record.companyId, companyName: record.companyName, snippet: quote,
        evidenceId: record.id, documentId: null, documentName: null, documentType: null,
        sourceDate: null, uploadedAt: null, chunkId: null, quote,
        location: { start: 0, end: quote.length },
      };
    });
    return finish(`${lines.length ? lines.join("\n") : "No companies match these recorded filters."}\n\nTotal companies: ${rows.length}.\nThese are current company records; source documents may describe earlier positions.`, "complete", citations);
  }

  let selection;
  try {
    if (Object.keys(plan.filters).length) {
      const filtered = await deps.repository.list(plan.filters);
      if (!filtered.length) return finish("No company records match these recorded filters.", "insufficient_evidence");
      const allowed = new Set(filtered.map((company) => company.id));
      const evidencePlan = { ...plan, companyIds: plan.companyIds.length ? plan.companyIds.filter((id) => allowed.has(id)) : [...allowed] };
      trace.plan = evidencePlan;
      selection = await selectMemoryEvidence(evidencePlan, filtered, deps);
    } else {
      selection = await selectMemoryEvidence(plan, catalog, deps);
    }
  } catch {
    return finish("Memory retrieval is temporarily unavailable. Please try again.", "provider_error");
  }
  trace.evidenceIds = selection.evidence.map((item) => item.id);
  trace.evidenceSufficiency = {
    sufficient: selection.sufficient, reason: selection.reason, omittedDocuments: selection.omittedDocuments,
  };
  if (!selection.sufficient) {
    return finish(`I don't have enough relevant recorded evidence to answer this question. ${selection.reason}`, "insufficient_evidence");
  }

  let completion;
  try {
    completion = await deps.generate(buildMemoryChatPrompt(plan, selection.evidence, selection.reason), {
      system: CHAT_SYSTEM, model: MODELS.reasoning, maxTokens: 1800, temperature: 0, json: true,
    });
  } catch {
    return finish("The answer provider is temporarily unavailable. Please try again.", "provider_error");
  }
  trace.generation = {
    configuredModel: completion.configuredModel,
    returnedModel: completion.returnedModel,
    finishReason: completion.finishReason,
    usage: completion.usage,
  };
  if (completion.finishReason !== "stop" || !completion.text.trim()) {
    return finish("The answer was incomplete and has been withheld. Please try a narrower question or retry.", "incomplete");
  }
  try {
    const validated = validateMemoryAnswer(JSON.parse(completion.text), selection.evidence);
    return finish(validated.answer, "complete", validated.citations);
  } catch {
    return finish("The generated answer could not be verified against the supplied sources. Please retry or narrow the question.", "invalid_response");
  }
}
