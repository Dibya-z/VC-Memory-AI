# Memory Chat implementation and verification

Implemented on `feat/memory-chat-rag`, November 25, 2026. The committed
[baseline](evaluations/memory-chat-baseline-2026-11-24.json) remains unchanged.
The [fixture report](evaluations/memory-chat-fixture-2026-11-25.json) runs the real
orchestration with a mocked repository and scripted providers. It is a regression
check of routing, evidence availability, provenance and response contracts, not a
measurement of live model accuracy.

## Six scopes

| Scope | Status | Implementation and verification |
|---|---|---|
| 1. Intent/entity routing | Implemented | `src/lib/ai/memory-plan.ts` validates eight allowlisted intents; `memory-repository.ts` uses typed Prisma lists/counts/current records. `tests/memory-plan.test.ts`, `memory-repository.test.ts`, and `memory-chat.test.ts` cover exact results, a sixth company, filters, source questions, unknown/ambiguous names and unsupported filters. |
| 2. Conversational references | Implemented | `src/lib/chat-context.ts`, `validators.ts`, `memory-plan.ts`, API route and `ChatWindow.tsx` carry bounded request context. User turns resolve identity; assistant prose never supplies facts. Tests cover topic switches, comparisons, independent concurrent requests, invalid roles, sizes and stale active IDs. No tables or process-global conversation state. |
| 3. Sufficient scoped evidence | Implemented | `memory-evidence.ts` reads company-specific complete short sources within 24,000 source characters, balances comparisons, searches matching sections/windows including the tail, and preserves source identity/dates/offsets. Semantic candidates require lexical subject corroboration. Tests cover full FlowAI conditions, mixed document types, long-source tails, irrelevant neighbors and budgets. |
| 4. Evidence-linked citations | Implemented | `memory-citations.ts` requires known IDs and exact retained excerpts, issues only used citations, and rejects malformed references, unsupported source types, obvious invented later memos and instruction-shaped support. Current-record inventories get server-built record references. `types.ts` and the client retain company links and add document/type/date/excerpt/character metadata. Citation and orchestration regressions cover valid/invalid sources and prompt injection. |
| 5. Complete task-specific answers | Implemented | `prompts.ts` supplies intent contracts and separates facts, interpretation, unknowns and diligence suggestions. `llm.ts` exposes configured/returned model, usage and finish reason while preserving other callers. `chat.ts` withholds empty, truncated or invalid output. Plain text rendering escapes HTML. Tests cover finish states, dangling clauses, malformed JSON, safe provider failures, ARR/MRR qualifiers and legacy completion compatibility. |
| 6. Executable evaluation | Implemented | `npm test`, `npm run eval:memory`, and guarded `eval:memory:live` share the production orchestrator. Fixtures load the actual five source files; all 13 baseline questions and both controls run. Reports separate correctness, completeness, provenance/source-support review, citation usefulness and task fit. Live target/corpus identity, request bounds and pacing have negative tests. |

## Setup and default checks

```bash
npm ci
npx prisma generate
npm test
npm run eval:memory -- --out /tmp/memory-chat-fixture.json
npm run lint
npm run typecheck
npm run build
npm run dev                       # localhost:3001
```

Node's `--import tsx` runs TypeScript without the CLI's IPC listener; this works in
restricted environments too. Tests do not load `.env`, call providers, or query a
database. They require generated Prisma types/client because the real API and
repository modules are imported. Client generation does not connect to a database.
Builds use the existing Google Fonts and may need network access for their first
fetch. If a managed environment prevents writing the Prisma cache, copy the
matching existing engine cache to a writable `XDG_CACHE_HOME` before generating.
No generated client, dependencies, `.env`, or build output belongs in Git.

Use an isolated development database or Neon branch for local application data.
`npm run setup`, `ingest:demo`, and `db:seed` delete existing application data.
Schema changes and resets were unnecessary for this implementation.

## Request, evidence and answer contracts

`POST /api/chat` accepts:

```json
{
  "message": "Who founded it, and what would make us lean in?",
  "history": [{"role":"user","content":"Prepare me for a meeting with FlowAI."}],
  "activeCompanyId": "optional-existing-company-id"
}
```

The message and each turn allow 4,000 characters; at most 12 prior user/assistant
turns and 16,000 total history characters are accepted. Streamed request bodies
are limited to 100,000 bytes. Context stays in the request/browser session.
Explicit current names override previous topics; ambiguous singular references
after comparisons ask for clarification. Assistant messages cannot establish
company facts or override the user's antecedent.

Supported exact filters are one recorded sector, one current recorded decision,
and last recorded interaction date bounds (ISO day, month/year or year, UTC).
Negation, OR, unrecorded-decision subsets, relative dates, stage, metric and
qualitative filters ask for clarification. Date filters use `Company.lastMetAt`,
not upload time or an exhaustive interaction log. Named historical source
questions keep date wording as part of the question rather than filtering the
current company record.

Lists/counts bypass both providers. Named recall reads retained sources directly;
sector summaries constrain company evidence. Other semantic questions embed the
standalone question, obtain up to 12 vector candidates, require conservative
lexical subject corroboration, and hydrate the actual source documents. No
universal cosine cutoff, hybrid retrieval framework, reranker or model switch
was introduced. Long documents use relevant sections/windows; incomplete
coverage is included in trace and generation instructions. Multiple same-type
sources do not establish which was "original" from their upload dates.

Evidence uses stable `doc:<documentId>:<start>-<end>` or `company:<companyId>`
identifiers. Source locations are zero-based character offsets with exclusive
ends in retained extracted text. The UI displays one-based character ranges;
these are not PDF pages or invented source lines. Only explicit source date
headings supply source dates, preserving month/year precision. Upload time is
separate metadata. Multiple chunks never create new documents.

Generation returns a JSON object containing typed blocks. New generations select
server-created passage IDs; the server constructs exact quotes and source
locations rather than asking the model to copy excerpts. Retained text is sent
once, with company identity and the real retained source heading attached to
each passage. GPT-OSS models use strict schema mode and low reasoning effort;
other configured models use validated JSON mode. One bounded corrective attempt
can recover an incomplete or invalid answer. Invalid sources and unfinished
answers remain withheld when recovery fails. Retrieved instructions have no tool
or query execution path and cannot change schemas, IDs or rendering. Pattern
checks reject common injection-shaped support; they cannot detect every attack.

Responses include `answer`, `citations`, `activeCompanyId`, `status` and `trace`.
The trace records validated intent/entities/filters, evidence IDs/coverage,
exact-query row counts or configured/returned generation model, usage (including
reasoning-token counts where supplied), finish reason, bounded attempt metadata,
sanitized failure categories, and orchestration elapsed time. It does not contain full source text,
keys, provider error payloads or an automatic private-content log.

See [runtime verification](MEMORY_CHAT_RUNTIME.md) for the generation-budget,
passage-citation and recovery changes, real-provider checks, and the opt-in
`npm run eval:memory:provider` command that uses public fixtures without a database.

## Before and after, with limits

These are source-based observations from the original live baseline versus
executable fixture assertions after implementation. The scripted answer text is
known in advance; this comparison establishes the application path's behavior
and the evidence supplied to generation. Live generation correctness remains
unmeasured in this clone.

| Acceptance group | Before | After fixture verification |
|---|---|---|
| Complete inventory/count | Three of five returned. | Five current records; deck-only decisions remain unrecorded. Adding a sixth changes list/count to six without providers. |
| CodeFlow decision/false premise | Core correction good; unrelated sources and extra claims. | Passed and excellent founders retained; adoption/churn/distribution/moat evidence supplied and used. |
| LedgerLite metrics | Correct figures, poor snippets. | $1.8M ARR, 134% NRR, 22 customers; supporting Traction excerpt contains all three. |
| FlowAI meeting/follow-up/conditions | Wrong founders on follow-up; conditions falsely absent even with explicit name. | FlowAI resolved from user turn; Grace Lin/Raj Patel and all three lean-in conditions reachable in full notes. No numeric month-3 target invented. |
| Missing runway/burn and Orchid Robotics | Correct abstention with unrelated citations. | Specific missing-field/company responses; no unrelated citations. Unknown company skips generation/retrieval. |
| CloudBrain actual versus target | Correct free pilots/zero ARR but fabricated reference. | Three free design partners and zero committed ARR retained; target ACV/fundraise stay targets; IDs/quotes verified. |
| Original decks | Correct no-decision conclusion with invented follow-up memo. | Original deck types selected; no inferred investment decisions; invented memo/reference regressions rejected. Demo README corrected. |
| Revenue and retention comparisons | Core units mostly correct; lost approximation and unfinished/unsupported additions. | Separate per-company evidence; ARR/MRR, approximately $9k, monthly churn versus month-2 cohort retention and source dates preserved in scripted responses. |
| Temporal change | Good core abstention, overlong and unrelated sources. | October baseline retained; no later source claimed and real-world change left unknown. |
| Completion, failure and trust boundaries | No finish telemetry; unfinished answer displayed. | Empty/length/filter/tool/unknown finish states and malformed citations withheld; safe provider failures; instruction-like source cases tested. |

Each evaluation case records the original review categories, selected evidence
IDs, answer, used excerpts, model metadata, finish status and separate evaluation
axes. Fixture source-support notes are an assistant review of the scripted
answers against the committed source documents, not independent human grading.
Live reports mark semantic support as requiring source-based human review; field
regex checks are diagnostic and can miss contradictions.

## PR #1 review regressions

The review follow-up fixes five query/answer boundary cases without changing the
schema, provider configuration, or original baseline fixtures:

| Finding | Corrected behavior | Regression coverage |
|---|---|---|
| Negative decisions | Contractions with straight or curly apostrophes cannot select the positive decision. Unsupported exclusions ask which decision to include. | Planner unit cases plus orchestration assertions that clarification performs no list/count, retrieval, or generation. |
| Date ranges | Supported between/from ranges constrain the current record's last interaction with inclusive UTC period endpoints. Malformed, reversed, partial, or unsupported date constraints clarify instead of broadening the result set. | Range fixtures contain exact start/end instants, out-of-range records and an undated record; actual returned company IDs are checked. |
| Count targets | Only supported company/startup/deal totals use the company count operation. Document, chunk, founder, mixed and unclear targets request clarification. | Unsupported-target spies assert no company count or generation; supported aliases still return the exact fixture total. |
| Capitalized business concepts | Phrases such as Key Risks and Business Model preserve a correctly resolved company. Genuine unknown companies, including mixed known/unknown comparisons, remain detected. | Scoped known-company evidence and unknown-company comparisons in both orders traverse the production orchestrator. |
| Missing later sources | Explicit negative source-absence clauses pass as unknowns. Affirmative invented later sources still fail, including after an absence clause in the same block. | Exact requested sentence, absence variants, mixed clauses, forged IDs/excerpts, and fabricated filenames remain covered. |

Review verification passed: **213 tests**, including 69 new planner variants,
49 orchestration regressions, and additional citation validation groups;
`npm run eval:memory` passed all 15 original baseline/control cases. Lint,
TypeScript checks and `npm run build` also passed. The build used a temporary
snapshot of this clone with inert database settings so the active development
server on port 3001 could keep its own build output. No production database or
live AI provider calls were made. No schema or dependency changes were needed.

Run `node --import tsx --test tests/memory-review-regressions.test.ts` for the
orchestration cases; `npm test` also runs the planner and citation unit variants.
The existing `npm run eval:memory` still covers all 15 baseline/control cases.
These checks use fixture repositories and mocked providers; no live database or
provider checks are required. Natural-language detection remains conservative:
unsupported phrasing clarifies or fails validation, and source provenance does
not establish semantic entailment.

## Further PR #1 parsing boundaries

The next review identified three cases that the previous 213 passing tests did
not cover. All three now have unit and production-orchestration regressions:

| Finding | Implemented behavior | New test file |
|---|---|---|
| Coordinated explanations mistaken for companies | Interrogative/imperative clause boundaries keep resolved companies in scope. Actual unknown comparison operands remain detected in either order and after explanatory clauses; quoted literal names and catalog identity retain precedence. | `tests/memory-explanation-boundary.test.ts` — 27 tests |
| Negated date ranges executed positively | Negation attached to a temporal predicate clarifies before any list/count query. Straight/curly contractions and between/from/in/during forms are covered. Affirmative inclusive bounds, empty results and invalid-date clarification retain `Company.lastMetAt` semantics. | `tests/memory-negated-date.test.ts` — 34 tests |
| Inventory plus an implicit total rejected | A clear company inventory supplies the target for its same-request count. Exact returned rows produce the list and total without embedding/generation. Qualitative count(s)-as questions use company evidence; explicit incompatible document/chunk counts still clarify. | `tests/memory-inventory-count.test.ts` — 25 tests |

Verification: **299 tests passed** (the previous 213 plus 86 new cases), all 15
fixture baseline/control evaluations passed, and lint, TypeScript, production
build and `git diff --check` passed. Tests assert actual answers, returned IDs,
used citations and query/provider calls, including a sixth company and empty
filtered inventories. The existing citation/fabrication safeguards, five prior
review fixes and request-scoped conversation tests remain passing.

The build used a temporary snapshot of this clone with inert database settings
to preserve the running port-3001 development server. No schema/dependency
changes, production database access, resets, reseeding, or live AI provider calls
were needed. Parsing remains a conservative English grammar; negative date
complements are deliberately unsupported and request an included date range.
Fixture/provider mocks verify orchestration, not live model answer accuracy.

## Optional live evaluation

No live database or provider evaluation was run for this change. No local `.env`
was present and no isolated development target was established. The command
refuses to continue by default; no production data was read or changed.

1. Independently verify a dedicated development database/Neon branch in its
   provider dashboard. Use read-only credentials where possible. Verify both
   pooled/direct URLs belong to it; do not copy shared production credentials.
2. Configure private `.env` using `.env.example`. Obtain an offline identity hash:

   ```bash
   npm run eval:memory:live -- --inspect-target
   ```

   This hashes host/port/database only; no connection or credential output.
3. After verifying isolation, set `MEMORY_CHAT_ENV=development`,
   `MEMORY_CHAT_ISOLATED_DATABASE=true`, a descriptive `MEMORY_CHAT_TARGET_LABEL`,
   and `MEMORY_CHAT_DATABASE_FINGERPRINT` to that hash. These are attestations,
   not proof of remote branch isolation. Production process/deployment flags and
   production labels are refused.
4. Explicitly acknowledge the target before inspecting the corpus read-only:

   ```bash
   npm run eval:memory:live -- --inspect-corpus \
     --target memory-chat-dev-branch --database-fingerprint <database-hash>
   ```

   It reports target/corpus hashes and counts, without raw documents. This
   baseline evaluator requires the processed corpus to exactly match the five
   committed fictional documents, with no additional/orphaned documents. It
   refuses corpus mismatches before provider use. Do not run ingestion to fix a
   mismatch on a shared database.
5. Compare that corpus hash with `corpusFingerprint` in the committed fixture
   report, then run selected cases, optionally repeating each twice:

   ```bash
   npm run eval:memory:live -- \
     --target memory-chat-dev-branch --database-fingerprint <database-hash> \
     --corpus-fingerprint <fixture-corpus-hash> \
     --cases flowai_followup,exact_metrics,retention_comparison \
     --repeat 2 --pace-ms 21000 --out /tmp/memory-chat-live.json
   ```

The command allows 1–5 distinct cases, 1–2 repetitions, and 20–60 seconds between
orchestration requests; generation is capped at 1,800 output tokens. Provider SDK
transport retries can add HTTP attempts. The corpus check precedes measured
per-case time, unlike the old baseline's elapsed-time definition. Reports retain
selected answers/excerpts, so keep them private if adapting to another corpus.
A selected repeated live sample still does not establish general accuracy.

## Verification and remaining limits

- `npm ci` and Prisma client generation succeeded; no schema changes.
- The original implementation passed 91 tests, lint, TypeScript check and production build. The
  initial restricted build failed to fetch Google Fonts; a network-enabled
  retry succeeded without changing typography.
- Built `/chat`, `/upload` and `/analyzer` returned HTTP 200 on localhost:3001;
  an invalid-role chat request returned 400 before database access. The local
  smoke server was stopped after checks. In-app browser control was unavailable,
  so this is HTTP/source verification, without visual browser QA.
- Upload, dashboard/company views, analyzer and briefs retain their routes and
  data model. Legacy completion string/JSON behavior has mocked compatibility
  tests. End-to-end database/provider workflows were not exercised; they require
  a verified development target and appropriate credentials.
- Exact quotes and IDs prove provenance, not semantic entailment. A model could
  attach a genuine quote to a false paraphrase or label a claim as an unknown or
  suggestion. Independent source-support review remains necessary.
- Conservative name/filter grammar and lexical corroboration may over-clarify or
  miss synonyms. Long sources can exceed the context budget; missing facts in
  partial coverage must stay qualified. No calibrated semantic recall estimate
  or statistical accuracy gain is claimed.
- Current company rows are accumulated extraction results, not a versioned
  decision ledger. Historical claims remain tied to documents. Source dates
  absent from explicit headers stay unknown.

Optional later experiments: larger independently labeled relevance/coverage
sets, repeated paced live cases, lexical+dense retrieval or reranking measured
separately for relevance, completeness, latency and provider usage. They are
outside the six baseline implementation scopes.
