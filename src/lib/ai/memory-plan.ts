import { z } from "zod";
import { DECISIONS, SECTORS } from "@/config/constants";
import type { MemoryCompany, MemoryFilters, QueryPlan } from "./memory-contract";

/** Only these operations/filters may cross the planning boundary. No SQL is accepted. */
export const queryPlanSchema = z.object({
  intent: z.enum(["inventory", "count", "filtered_list", "company_recall", "comparison", "meeting_preparation", "semantic_explanation", "clarification"]),
  companyIds: z.array(z.string().min(1)).max(20),
  filters: z.object({
    sector: z.string().min(1).max(200).optional(),
    decision: z.enum(DECISIONS).optional(),
    metAfter: z.string().datetime().optional(),
    metBefore: z.string().datetime().optional(),
  }).strict(),
  standaloneQuestion: z.string().min(1).max(12000),
  clarification: z.string().max(500).optional(),
  unknownCompany: z.string().max(200).optional(),
}).strict();

export interface PlanningRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  activeCompanyId?: string;
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namePattern(value: string): RegExp {
  const body = value.trim().split(/[\s-]+/).map(escapePattern).join("[\\s-]*");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "iu");
}

/** Exact catalog names and unambiguous names with the separate suffix AI omitted. */
function mentions(text: string, catalog: MemoryCompany[]): MemoryCompany[] {
  return catalog.filter((company) => {
    if (namePattern(company.name).test(text)) return true;
    const base = company.name.replace(/\s+AI$/i, "");
    return base !== company.name && base.length >= 5 &&
      catalog.filter((item) => item.name.replace(/\s+AI$/i, "").toLowerCase() === base.toLowerCase()).length === 1 &&
      namePattern(base).test(text);
  });
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Date periods are interpreted in UTC against lastMetAt, never document upload time. */
function period(value: string): { start: Date; end: Date } | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const start = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== value) return null;
    return { start, end: new Date(start.getTime() + 86400000 - 1) };
  }
  const month = /^([a-z]+)\s+(\d{4})$/i.exec(value);
  if (month) {
    const index = MONTHS.indexOf(month[1].toLowerCase());
    if (index < 0) return null;
    return { start: new Date(Date.UTC(+month[2], index, 1)), end: new Date(Date.UTC(+month[2], index + 1, 1) - 1) };
  }
  if (/^\d{4}$/.test(value)) return { start: new Date(Date.UTC(+value, 0, 1)), end: new Date(Date.UTC(+value + 1, 0, 1) - 1) };
  return null;
}

function dateFilters(text: string): { filters: MemoryFilters; error?: string } {
  const filters: MemoryFilters = {};
  const matches = [...text.matchAll(/\b(since|after|before|during|in|through|until)\s+(\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{4}|\d{4})\b/gi)];
  for (const match of matches) {
    const range = period(match[2]);
    if (!range) return { filters: {}, error: "Which valid date or month and year should I use for the last recorded interaction?" };
    switch (match[1].toLowerCase()) {
      case "since": filters.metAfter = range.start.toISOString(); break;
      case "after": filters.metAfter = new Date(range.end.getTime() + 1).toISOString(); break;
      case "before": filters.metBefore = new Date(range.start.getTime() - 1).toISOString(); break;
      case "through": case "until": filters.metBefore = range.end.toISOString(); break;
      default: filters.metAfter = range.start.toISOString(); filters.metBefore = range.end.toISOString();
    }
  }
  if (/\b(last|this|next)\s+(week|month|quarter|year)|\brecent(?:ly)?\b|\bQ[1-4]\b/i.test(text)) {
    return { filters: {}, error: "What date range should I use for the last recorded interaction? Please give dates or a month and year." };
  }
  if (/\b(since|after|before|during|through|until)\b/i.test(text) && !matches.length) {
    return { filters: {}, error: "Which date or month and year should I use for the last recorded interaction?" };
  }
  if (filters.metAfter && filters.metBefore && filters.metAfter > filters.metBefore) {
    return { filters: {}, error: "The date range ends before it starts. Which interaction date range should I use?" };
  }
  return { filters };
}

/** Detect an explicitly named unknown entity instead of searching unrelated neighbors. */
function unknownName(text: string, catalog: MemoryCompany[], sectors: string[]): string | undefined {
  let remainder = text;
  for (const item of [...catalog.flatMap((c) => [c.name, c.name.replace(/\s+AI$/i, "")]), ...sectors]) remainder = remainder.replace(namePattern(item), "");
  const candidates: string[] = [...(remainder.match(/\b[A-Z][A-Za-z0-9]*(?:\s+(?:[A-Z][A-Za-z0-9]*|AI)){1,3}\b/g) ?? [])];
  const single = /\b(?:about|on|with|for|from|founded)\s+([A-Z][A-Za-z0-9-]{2,})\b/.exec(remainder)?.[1];
  if (single && !/^[A-Z]{2,6}$/.test(single)) candidates.push(single);
  const explicit = /\b(?:decision on|founded|company named|startup named|meeting with)\s+([a-zA-Z][a-zA-Z0-9-]*(?:\s+(?!and\b|or\b|in\b|for\b|with\b)[a-zA-Z][a-zA-Z0-9-]*){0,3})/i.exec(remainder)?.[1];
  if (explicit && !/^(?:it|them|they|its|their|a|an|the|who|what|our|we|us)\b/i.test(explicit)) candidates.push(explicit);
  return candidates.find((candidate) => !/^(?:What|Which|Who|How|Since|Please|Compare|Prepare|Give|List|Say|Keep|Do|No|If|Did|Have|Can|Tell|Show|Summarize|Memory|Firm)\b/.test(candidate) &&
    !/^(?:ARR|MRR|NRR|ACV|CEO|CTO|AI|Seed|Series|Investment|Developer|Net|Month)\b/.test(candidate));
}

function decisions(text: string): MemoryFilters["decision"][] {
  const found: MemoryFilters["decision"][] = [];
  if (/\bpass(?:ed)?\b/i.test(text)) found.push("Passed");
  if (/\binvest(?:ed)?\b/i.test(text)) found.push("Invested");
  if (/\btrack(?:ing|ed)?\b/i.test(text)) found.push("Tracking");
  if (/\binterested\b/i.test(text)) found.push("Interested");
  return found;
}

/** Rule-based planning is deliberately conservative; unsupported filters ask for clarification. */
export function planMemoryQuery(request: PlanningRequest, catalog: MemoryCompany[]): QueryPlan {
  const text = request.message.trim();
  const base: QueryPlan = { intent: "semantic_explanation", companyIds: [], filters: {}, standaloneQuestion: text };
  const finish = (plan: QueryPlan): QueryPlan => {
    const parsed = queryPlanSchema.parse(plan);
    if (parsed.companyIds.some((id) => !catalog.some((c) => c.id === id))) throw new Error("Plan contains an unknown company identifier.");
    return parsed;
  };
  const clarify = (message: string) => finish({ ...base, intent: "clarification", clarification: message });
  if (!text) return clarify("What would you like to know about the firm's memory?");
  const knownSectors = [...new Map([...SECTORS, ...catalog.flatMap((c) => c.sector ? [c.sector] : [])]
    .map((sector) => [sector.toLowerCase(), sector])).values()];
  let companies = mentions(text, catalog);
  if (companies.some((company, i) => companies.some((other, j) => i !== j && namePattern(company.name).test(other.name)))) {
    return clarify(`That name matches multiple company records: ${companies.map((c) => c.name).join(" or ")}. Which record do you mean?`);
  }
  const prefix = /\b(?:about|with|on|for)\s+([A-Za-z][A-Za-z0-9-]{2,})\b/i.exec(text)?.[1];
  if (!companies.length && prefix) {
    const candidates = catalog.filter((c) => c.name.toLowerCase().startsWith(prefix.toLowerCase()));
    if (candidates.length > 1) return clarify(`Which company do you mean: ${candidates.map((c) => c.name).join(" or ")}?`);
  }
  const unknown = unknownName(text, catalog, knownSectors);
  if (unknown) return finish({ ...base, intent: "company_recall", companyIds: companies.map((c) => c.id), unknownCompany: unknown });

  const compare = /\bcompar(?:e|ing|ison)|\bversus\b|\bvs\.?\b/i.test(text);
  const reference = /\b(it|its|they|their|them)\b/i.test(text);
  const implicitReference = /^(?:and\b|also\b|what about\b|who founded\b)/i.test(text);
  const collectionRequest = /\b(?:list|show|which|what|every|all|how many|count)\b.*\b(?:compan(?:y|ies)|startups?|deals?)\b/i.test(text);
  if ((!companies.length && !collectionRequest && (reference || implicitReference)) || (companies.length === 1 && compare && /\b(it|them)\b/i.test(text))) {
    let antecedents: MemoryCompany[] = [];
    let topicReset = false;
    for (const turn of [...(request.history ?? [])].reverse()) {
      if (turn.role !== "user") continue;
      const previous = mentions(turn.content, catalog);
      if (previous.length) { antecedents = previous; break; }
      if (unknownName(turn.content, catalog, knownSectors) || !/\b(it|its|they|their|them)\b|^(?:and\b|also\b|what about\b|who founded\b)/i.test(turn.content)) { topicReset = true; break; }
    }
    if (!antecedents.length && request.activeCompanyId && !topicReset) {
      const active = catalog.find((c) => c.id === request.activeCompanyId);
      if (!active) return clarify("The active company is no longer in memory. Which company do you mean?");
      antecedents = [active];
    }
    if (antecedents.length > 1 && !compare) return clarify(`Which company do you mean: ${antecedents.map((c) => c.name).join(" or ")}?`);
    if (!antecedents.length) return clarify("Which company do you mean?");
    companies = [...new Map([...antecedents, ...companies].map((c) => [c.id, c])).values()];
    base.standaloneQuestion = `${text}\nResolved company reference: ${companies.map((c) => c.name).join(", ")}.`;
  }
  base.companyIds = companies.map((c) => c.id);
  if (companies.length) {
    if (companies.length > 20) return clarify("Please compare no more than 20 companies at a time.");
    if (compare || companies.length > 1) return finish({ ...base, intent: "comparison" });
    if (/\b(?:prep(?:are)?\b.*\bmeeting|meeting\b.*\bprep)/i.test(text)) return finish({ ...base, intent: "meeting_preparation" });
    return finish({ ...base, intent: "company_recall" });
  }

  // Sector and decision strings are allowlisted catalog values, not model-generated query code.
  const sectorMatches = knownSectors.filter((sector) => namePattern(sector).test(text));
  if (sectorMatches.length > 1) return clarify(`Which sector should I filter by: ${sectorMatches.join(" or ")}?`);
  const decisionMatches = decisions(text);
  if (decisionMatches.length > 1) return clarify("Which recorded decision should I filter by: Interested, Passed, Invested, or Tracking?");
  const explicitList = /\b(?:list|show|which|every|all|what)\b.*\b(?:compan(?:y|ies)|startups?|deals?)\b|\b(?:compan(?:y|ies)|startups?|deals?)\b.*\b(?:list|every|all|inventory)\b/i.test(text);
  const isCount = /\bhow many\b|\b(?:company|companies|startup|startups)\s+count\b|^count\b/i.test(text);
  const broad = explicitList || isCount || sectorMatches.length > 0;
  if (broad) {
    const date = dateFilters(text);
    if (date.error) return clarify(date.error);
    base.filters = { ...date.filters, ...(sectorMatches[0] ? { sector: sectorMatches[0] } : {}), ...(decisionMatches[0] ? { decision: decisionMatches[0] } : {}) };
    const negativeSector = sectorMatches.some((sector) => new RegExp(`\\b(?:not(?:\\s+in)?|except|excluding|exclude|other than|outside(?:\\s+of)?)\\s+(?:the\\s+)?${escapePattern(sector)}\\b|\\bnon[- ]${escapePattern(sector)}\\b`, "i").test(text));
    if (negativeSector || (/\bor\b/i.test(text) && Object.keys(base.filters).length > 0) || /\bnot\s+(?:before|after|since|during)\b/i.test(text)) {
      return clarify("Exact filters support one included sector, one recorded decision, and an interaction date range. Which values should I include?");
    }
    if (/\b(?:uploaded?|created?|updated?|changed?|changes)\b/i.test(text)) {
      return clarify("Date filters apply to the current record's last recorded interaction, not upload timestamps or historical decision changes. Which interaction date range should I use?");
    }
    if (decisionMatches.length && /\b(?:not|except|excluding|exclude|other than)\b/i.test(text)) {
      return clarify("Exact decision filters select one recorded decision. Which decision should I include: Interested, Passed, Invested, or Tracking?");
    }
    if (!/\bsay\b.*\bnot recorded\b/i.test(text) && /\b(?:no|unrecorded|missing)\s+(?:recorded\s+|investment\s+)?decision|\bwithout\s+(?:a\s+)?(?:recorded\s+)?decision/i.test(text)) {
      return clarify("Do you want all current company records with their decision shown as recorded, or a specific decision: Interested, Passed, Invested, or Tracking?");
    }
    if (/\b(?:for\s+.+\bconcerns?|GTM|go.to.market|churn|retention|adoption|moat|concerns?|strong|weak|best|worst|promising)\b/i.test(text) || (!sectorMatches.length && /\bAI\s+(?:startups?|compan(?:y|ies)|deals?)\b/i.test(text))) {
      return clarify("Should I filter by a recorded sector or decision, or explain concerns from source documents? Exact lists support sector, decision, and last recorded interaction date.");
    }
    if (/\b(?:valuations?|headquarters|location|geograph|country|countries|employees?|fundrais|raised|revenue|ARR|MRR|stage|seed|series|profitable|profitability)\b/i.test(text)) {
      return clarify("Exact filters support sector, recorded decision, and last recorded interaction date. Which of those should I use?");
    }
    const sectorPhrase = /\b(?:in|sector(?:\s+is)?|sector:)\s+(?:the\s+)?([A-Za-z][A-Za-z &-]*?)(?=\s+(?:sector|since|after|before|during|with|that|and)\b|[?.!,]|$)/i.exec(text)?.[1]?.trim();
    if (sectorPhrase && !sectorMatches.length && !/^(?:our|the|firm|memory|total|\d)/i.test(sectorPhrase) && !MONTHS.some((month) => sectorPhrase.toLowerCase().startsWith(month))) {
      return clarify(`Which recorded sector do you mean by "${sectorPhrase}"? Available sectors include ${knownSectors.join(", ")}.`);
    }
    if (!explicitList && !isCount) return finish({ ...base, intent: "semantic_explanation" });
    if (isCount && !/\b(?:list|show|which)\b/i.test(text)) return finish({ ...base, intent: "count" });
    return finish({ ...base, intent: Object.keys(base.filters).length ? "filtered_list" : "inventory" });
  }
  if (request.activeCompanyId && !catalog.some((c) => c.id === request.activeCompanyId)) return clarify("The active company is no longer in memory. Which company do you mean?");
  return finish(base);
}
