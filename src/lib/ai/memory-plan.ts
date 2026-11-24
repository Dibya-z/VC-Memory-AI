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

const DATE_VALUE = String.raw`(?:\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{4}|\d{4})(?![\w/-])`;

/** Unsupported date complements must never become their positive range. */
function hasNegatedDateConstraint(text: string): boolean {
  const normalized = text.replace(/[’‘ʼ]/g, "'");
  const operators = String.raw`(?:between|from|in|during|within|on|after|before|since|through|until)`;
  // Link a negation to its temporal predicate, rather than to an unrelated
  // instruction elsewhere in the request (for example, "do not infer facts").
  const predicate = String.raw`(?:(?:[a-z]+ly|ever|yet|sometime|any|a|an|the|last|first|most|recent|recorded|interaction|interactions|meeting|meetings|date|dates|have|having|had|be|been|was|were|is|are|met|meet|interact|interacted|happen|happened|occur|occurred|fall|falls|fell|take|taken|place|at|with|as|all)\s+)*`;
  if (new RegExp(String.raw`\b(?:not|never|neither|without|cannot|[a-z]+n't)\s+${predicate}${operators}\b`, "i").test(normalized)) {
    return true;
  }
  const excludedRange = String.raw`\b(?:outside|excluding|except)\s+(?:(?:of|the|a|an|that|this|same|last|recorded|interaction)\s+)*(?:${operators}\b|(?:date\s+)?(?:range|period|window)\b|${DATE_VALUE})`;
  return new RegExp(excludedRange, "i").test(normalized);
}

function dateFilters(text: string): { filters: MemoryFilters; error?: string } {
  if (hasNegatedDateConstraint(text)) {
    return { filters: {}, error: "Negated interaction date filters are not supported. Which included date range should I use for the last recorded interaction?" };
  }
  const filters: MemoryFilters = {};
  const invalidDate = "Which valid date or month and year should I use for the last recorded interaction?";
  let invalid = false;
  let remainder = text;
  const include = (start?: string, end?: string) => {
    // Repeated bounds intersect instead of silently overwriting another constraint.
    if (start && (!filters.metAfter || start > filters.metAfter)) filters.metAfter = start;
    if (end && (!filters.metBefore || end < filters.metBefore)) filters.metBefore = end;
  };
  for (const pattern of [
    new RegExp(String.raw`\bbetween\s+(${DATE_VALUE})\s+and\s+(${DATE_VALUE})`, "gi"),
    new RegExp(String.raw`\bfrom\s+(${DATE_VALUE})\s+(?:to|through|until)\s+(${DATE_VALUE})`, "gi"),
  ]) {
    remainder = remainder.replace(pattern, (match, from: string, to: string) => {
      const start = period(from), end = period(to);
      if (!start || !end) invalid = true;
      else include(start.start.toISOString(), end.end.toISOString());
      return " ".repeat(match.length);
    });
  }
  const bounds = new RegExp(String.raw`\b(since|after|before|during|in|through|until)\s+(${DATE_VALUE})`, "gi");
  remainder = remainder.replace(bounds, (match, operator: string, value: string) => {
    const range = period(value);
    if (!range) invalid = true;
    else switch (operator.toLowerCase()) {
      case "since": include(range.start.toISOString()); break;
      case "after": include(new Date(range.end.getTime() + 1).toISOString()); break;
      case "before": include(undefined, new Date(range.start.getTime() - 1).toISOString()); break;
      case "through": case "until": include(undefined, range.end.toISOString()); break;
      default: include(range.start.toISOString(), range.end.toISOString());
    }
    return " ".repeat(match.length);
  });
  if (invalid) return { filters: {}, error: invalidDate };
  if (/\b(last|this|next)\s+(week|month|quarter|year)|\brecent(?:ly)?\b|\bQ[1-4]\b|\b(?:yesterday|today|tomorrow)\b/i.test(text)) {
    return { filters: {}, error: "What date range should I use for the last recorded interaction? Please give dates or a month and year." };
  }
  // Every requested date constraint must be consumed. A valid first bound does
  // not excuse an unsupported second bound or a malformed range endpoint.
  const unparsedFrom = /\bmet\s+from\b/i.test(remainder) || new RegExp(String.raw`\bfrom\s+(?:\d|${MONTHS.join("|")}|last|this|next|early|late|mid|the\s+(?:start|end))`, "i").test(remainder);
  const unparsedPeriod = new RegExp(String.raw`\b(?:${MONTHS.join("|")}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|spring|summer|autumn|fall|winter)\b`, "i").test(remainder);
  if (unparsedFrom || unparsedPeriod || /\bmet\s+(?:on|in|at)\b|\b(?:since|after|before|during|through|until|between|date range|dates?|dated)\b|\b\d{4}(?:[-/]\d{1,2})?\b/i.test(remainder)) {
    return { filters: {}, error: "Which complete interaction date range should I use? Give ISO dates, month and year, or years, using between…and or from…to." };
  }
  if (filters.metAfter && filters.metBefore && filters.metAfter > filters.metBefore) {
    return { filters: {}, error: "The date range ends before it starts. Which interaction date range should I use?" };
  }
  return { filters };
}

/** Business vocabulary is not an entity merely because a question title-cases it. */
const BUSINESS_WORDS = new Set(("what which who how since please compare prepare give list say keep do no if did have can tell show summarize memory firm " +
  "is are was were the a an for of with in our their its it them they we us and or all many company companies startup startups deal deals count counts total passed invested interested tracking " +
  "key risk risks business model models investment decision decisions recorded record current " +
  "founder founders team teams strengths strength concerns concern market size problem solution " +
  "traction revenue retention net gross margin margins monthly annual cash burn runway rate rates " +
  "adoption pricing competition competitive moat metrics metric overview summary customer customers " +
  "platform partners partner enterprise notes memo deck date month arr mrr nrr acv ceo cto ai " +
  "seed series developer tools history historical ask fundraising diligence questions facts latest updates gtm monday tuesday wednesday thursday friday saturday sunday " +
  MONTHS.join(" ")).split(" "));

/** Detect named unknowns in entity slots while retaining known/unknown comparisons. */
function unknownName(text: string, catalog: MemoryCompany[], sectors: string[]): string | undefined {
  let remainder = text;
  for (const item of catalog.flatMap((c) => [c.name, c.name.replace(/\s+AI$/i, "")])) {
    remainder = remainder.replace(new RegExp(namePattern(item).source, "giu"), " ⟦known⟧ ");
  }
  for (const sector of sectors) remainder = remainder.replace(new RegExp(namePattern(sector).source, "giu"), " ");

  const candidate = (value: string | undefined, explicitlyNamed = false): string | undefined => {
    if (!value) return undefined;
    let clean = value.trim().replace(/^["“‘']+|["”’']+$/g, "").replace(/['’]s$/i, "");
    if (!explicitlyNamed) clean = clean.replace(/^(?:(?:compare|please|tell|show|summarize|about|for|on|with|from|between)\s+)+/i, "");
    if (clean.length < 3 || /^(?:it|them|they|its|their|a|an|the|who|what|our|we|us)\b/i.test(clean)) return undefined;
    const words = clean.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    if (!explicitlyNamed && words.every((word) => BUSINESS_WORDS.has(word))) return undefined;
    return clean;
  };
  const entityWords = String.raw`[A-Za-z][A-Za-z0-9'-]*(?:\s+(?!(?:and|or|versus|vs|between|in|for|with|on|of|who|what|whose|that|which|are|is|was|were|has|have|had|did|does|do|recorded|differ|compare)\b)[A-Za-z][A-Za-z0-9'-]*){0,3}`;
  for (const match of remainder.matchAll(new RegExp(String.raw`\b(company named|startup named|decision on|founded|meeting with)\s+["“‘']?(${entityWords})`, "gi"))) {
    const name = candidate(match[2], /named$/i.test(match[1]));
    if (name) return name;
  }
  // Explicit comparison positions also retain lower-case unknown names and
  // names after a known company, rather than ignoring the unresolved operand.
  for (const pattern of [
    new RegExp(String.raw`\b(?:compare|versus|vs|between)\s+["“‘']?(${entityWords})`, "gi"),
    new RegExp(String.raw`⟦known⟧\s*(?:,?\s*(?:as\s+opposed\s+to|rather\s+than|compared\s+(?:with|to))|,|and|or|versus|vs\.?|with)\s+["“‘']?(${entityWords})`, "gi"),
    new RegExp(String.raw`(${entityWords})\s+(?:and|or|versus|vs\.?)\s+⟦known⟧`, "gi"),
  ]) {
    for (const match of remainder.matchAll(pattern)) {
      const name = candidate(match[1]);
      if (name) return name;
    }
  }
  for (const match of remainder.matchAll(new RegExp(String.raw`\b(?:about|on|with|for|from|founded)\s+([A-Z][A-Za-z0-9'-]*(?:\s+(?!(?:and|or|in|for|with|on|of)\b)[A-Z][A-Za-z0-9'-]*){0,3})\b`, "g"))) {
    const name = candidate(match[1]);
    if (name) return name;
  }
  const hasKnownCompany = remainder.includes("⟦known⟧");
  for (const match of hasKnownCompany ? [] : remainder.matchAll(/\b[A-Z][A-Za-z0-9]*(?:\s+(?:[A-Z][A-Za-z0-9]*|AI)){1,3}\b/g)) {
    const trimmed = match[0].replace(/^(?:(?:What|Which|Who|How|Since|Please|Compare|Prepare|Give|List|Say|Keep|Do|No|If|Did|Have|Can|Tell|Show|Summarize|Memory|Firm|Is|Are|The|A|An|For|Of|With)\s+)+/, "");
    const name = candidate(trimmed);
    if (name) return name;
  }
  return undefined;
}

/** An exact count always needs a positively identified, supported target. */
function countRequest(text: string, sectors: string[]): { requested: boolean; supported: boolean } {
  const requested = /\bhow\s+many\b|\bcounts?\b/i.test(text) || /^(?:what(?:'s| is| are)?\s+(?:the\s+)?|give\s+(?:me\s+)?(?:the\s+)?|show\s+(?:me\s+)?(?:the\s+)?)?(?:number|total)\s+of\b/i.test(text);
  if (!requested) return { requested: false, supported: false };
  const targets: string[] = [];
  const end = String.raw`(?=[?.!;]|\b(?:are|is|were|was|do|does|did|have|has|had|with|for|from|in|stored|currently|recorded|exist|we)\b|$)`;
  for (const pattern of [
    new RegExp(String.raw`\bhow\s+many\s+(.+?)${end}`, "gi"),
    new RegExp(String.raw`\bcount\s+(?!of\b)(.+?)${end}`, "gi"),
    new RegExp(String.raw`\b(?:count|number|total)\s+of\s+(.+?)${end}`, "gi"),
    /\b([A-Za-z][A-Za-z-]*(?:\s+(?:and|or)\s+[A-Za-z][A-Za-z-]*)*)\s+counts?\b/gi,
  ]) {
    for (const match of text.matchAll(pattern)) targets.push(match[1]);
  }
  const supported = targets.length > 0 && targets.every((target) => {
    for (const sector of sectors) target = target.replace(namePattern(sector), "");
    return /^(?:(?:all|the|our|total|current|distinct|unique|different|existing|invested|passed|interested|tracking)\s+)*(?:compan(?:y|ies)|startups?|deals?)(?:\s*(?:,|and|or)\s*(?:compan(?:y|ies)|startups?|deals?))*$/i.test(target.trim());
  });
  return { requested, supported };
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
  const clarify = (message: string) => finish({ ...base, intent: "clarification", filters: {}, clarification: message });
  if (!text) return clarify("What would you like to know about the firm's memory?");
  const knownSectors = [...new Map([...SECTORS, ...catalog.flatMap((c) => c.sector ? [c.sector] : [])]
    .map((sector) => [sector.toLowerCase(), sector])).values()];
  const counting = countRequest(text, knownSectors);
  if (counting.requested && (!counting.supported || (!/\b(?:list|show|which)\b/i.test(text) && /\b(?:documents?|chunks?|founders?|customers?|partners?)\b/i.test(text)))) {
    return clarify("Exact counts support companies, startups, or deals. What company count would you like? Counts of documents, chunks, people, or other targets are not supported.");
  }
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
  const isCount = counting.requested;
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
    if (decisionMatches.length && /\b(?:not|never|except|excluding|exclude|other than|without|cannot|[a-z]+n't)\b/i.test(text.replace(/[’‘ʼ]/g, "'"))) {
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
