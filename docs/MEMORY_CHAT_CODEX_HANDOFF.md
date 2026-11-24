# Memory Chat implementation handoff

Implement all six Memory Chat improvements described below in this repository. Make the application changes, add runnable tests, and verify the result. Do not stop after another audit, explanation, or implementation plan.

## Project purpose and boundaries

VC Memory AI is institutional memory for a venture capital team. It must recall company facts, recorded investment decisions and reasons, compare opportunities, prepare meetings, and acknowledge missing information. Preserve the distinction between recorded facts, historical decisions, analyst interpretations, and suggested diligence questions.

The application is Next.js 14 with React 18 and TypeScript, Prisma 6 with PostgreSQL on Neon, Groq for generation, and Voyage for embeddings. Keep this stack while fixing Memory Chat. Preserve upload, dashboard, company views, analyzer, and investment briefs. Preserve the existing light interface and current design tokens; this is not a redesign or a framework-upgrade task.

Create a feature branch if the user has not already created one. Inspect the working tree and preserve unrelated changes. Use the repository's configured Git identity; never change global identity, rewrite existing commits, or delete Git history. After verification, make focused local commits and report their hashes. Do not push, merge, or deploy without a separate instruction.

## Read these files first

- `docs/evaluations/memory-chat-baseline-2026-11-24.json`
- `src/lib/ai/chat.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/llm.ts`
- `src/lib/vector/store.ts`
- `src/lib/vector/local-store.ts`
- `src/lib/vector/similarity.ts`
- `src/lib/db/queries.ts`
- `src/lib/types.ts`
- `src/lib/validators.ts`
- `src/app/api/chat/route.ts`
- `src/components/chat/ChatWindow.tsx`
- `prisma/schema.prisma`
- The actual document files in `data/demo/`.

Inspect the repository's current versions rather than assuming they are unchanged from the baseline.

## Current implementation and transferable evidence

The current chat receives only `{ message }`, embeds the question, retrieves the top six chunks across the corpus, builds a prompt, and returns a generated answer. It then attaches a company-level citation list from retrieved chunks, regardless of which sources the answer used. The client retains displayed turns in React state but does not send earlier turns to the backend.

The vector interface already supports a `companyId` filter. Stored chunk records include document and company relationships, but the chat context lacks adequate document identity and source-location metadata. Search has no calibrated relevance gate. The completion wrapper returns a string without exposing finish reason or usage to the caller.

The committed baseline JSON contains 13 baseline questions and two diagnostic controls against five fictional companies, five documents, and fourteen chunks. It preserves exact questions, expected evidence, responses, and qualitative assessments. It is evidence, not an executable test suite or a statistical accuracy benchmark. Build a portable test harness; do not depend on temporary scripts from the previous machine.

Observed failures include:

1. A request for every company returned three names and a total of three, although the database contained five.
2. After preparing for a FlowAI meeting, the follow-up "Who founded it, and what would make us lean in?" returned CloudBrain AI's founders.
3. An explicit FlowAI question recovered its founders but falsely claimed there were no recorded investment conditions.
4. In a separate control, supplying the complete FlowAI note to the configured model restored the conditions. This supports an evidence-selection/context-use problem, although the live API did not expose enough telemetry to isolate retrieval alone.
5. Sources included unrelated companies; an unknown-company answer cited all five companies.
6. A response invented the line reference `【2†L1-L4】`, and another invented a CloudBrain follow-up memo even though the source corpus contained only its deck.
7. Some answers added unsupported claims, expanded unnecessarily into meeting preparation, or ended mid-list.

Preserve the demonstrated strengths: exact metric recall, ARR/MRR distinction, correction of false premises, and refusal to invent unknown-company information or missing runway/burn figures.

The evaluated local `.env` selected Groq `openai/gpt-oss-120b`; the code default is `llama-3.3-70b-versatile`. The embedding default was `voyage-3.5`. Preserve environment overrides. Do not hardcode the previous machine's model selection or publish credentials.

## Scope 1 Intent and entity routing

Implement a validated query plan covering inventory, count, filtered list, company recall, comparison, meeting preparation, semantic explanation, and clarification.

Extract company references and supported sector/decision/date constraints. Use typed Prisma operations for exact lists, counts, and current recorded decisions. Do not calculate corpus totals from retrieved passages, and do not execute arbitrary model-generated SQL. Validate any model-generated plan against an allowlisted schema before using it.

Use document retrieval for explanations and source-specific questions. Distinguish a current company record from a historical source claim. When an entity or filter is ambiguous, ask a focused clarification rather than silently guessing.

Never hardcode the five baseline company names, company count, database IDs, or expected answers into runtime application logic. Those values belong only in isolated test fixtures.

## Scope 2 Conversational reference resolution

Extend the request/client contract to carry bounded recent context and/or an explicit active-company reference. Resolve "it," "they," and "their" into an appropriate standalone retrieval question before searching. Handle topic changes, comparisons involving multiple companies, and ambiguous references.

Keep context request/session-scoped. Never implement a process-global last company or shared conversation state. Validate allowed roles, message count, and text lengths. Client-provided history may resolve references, but earlier generated prose is not authoritative evidence for company facts.

Permanent chat persistence is optional; bounded conversational context does not require adding database tables. The current schema intentionally contains Company, Document, and Chunk after unused Conversation/Message models were removed. Add schema changes only for a concrete requirement and with a safe migration plan.

## Scope 3 Sufficient company-specific evidence

Use existing company filters for named-company questions. For short documents, include the complete relevant source or all relevant sections within an explicit context budget. For comparisons, gather evidence for each requested company so one company's passages do not dominate.

Carry document ID/name/type, chunk ID or verified text location, company identity, and relevant source dates. Distinguish source/interaction dates from upload timestamps. Multiple chunks from one document must not be described as separate memos.

Add an evidence-sufficiency check. Distinguish no relevant evidence from merely having some nearest neighbors. Calibrate any threshold on the evaluation set; do not select an arbitrary universal cosine cutoff. Source facts near the end of a document must remain reachable.

Implement baseline improvements before adding optional hybrid keyword/vector retrieval or reranking. Evaluate those additions separately for relevance, completeness, latency, and provider usage. A new vector database, large RAG framework, model switch, or fine-tuning is not a prerequisite for the core fixes.

## Scope 4 Validated evidence-linked citations

Assign stable identifiers to supplied evidence. Require the generated answer to reference only those identifiers, and validate references on the server before returning citations.

Return only used sources with supporting excerpts, document identity, and valid locations where available. Check that quoted excerpts match retained source text. Do not fabricate PDF pages or line references; do not allow the model to invent document titles. An absent-company response must not list unrelated documents as evidence.

Choose snippets around the supported fact rather than always the first 160 characters of a company's first retrieved chunk. Preserve compatibility with company links while extending types/API/UI to support richer source information.

Identifier and quote checks establish provenance, not semantic entailment. Include source-support assessment in the evaluation as well.

## Scope 5 Task-specific complete answers

Use concise answer contracts appropriate to each intent:

- Fact lookup: direct answer, relevant qualifiers/date, supporting source.
- Decision question: recorded decision and principal recorded reasons.
- Comparison: compact comparison covering the requested fields.
- Meeting preparation: recorded facts, previous position, unknowns, suggested questions.
- Missing evidence: identify precisely what is not recorded.

Separate facts, interpretations, and generated diligence suggestions. Preserve approximations, currency/units, time periods, and actual-versus-target distinctions. The absence of an update in memory does not establish that no change occurred in the real world.

Expose completion metadata and handle empty, truncated, or otherwise incomplete responses. A response ending mid-list must not silently appear as complete. Do not solve verbosity solely by raising output limits.

Render the selected answer format consistently. If using Markdown, use safe rendering without enabling arbitrary raw HTML. Otherwise request and present plain text consistently. Preserve the current UI styling, responsive behavior, and accessible interactions.

Treat uploaded/retrieved text as untrusted evidence, not application instructions. Add regression cases containing instruction-like source text. Prompt wording alone is not a complete trust boundary.

## Scope 6 Executable evaluation and verification

Convert the baseline cases into isolated fixtures and runnable regression tests. Use mocked providers and an isolated repository/database interface for default tests; test the real orchestration paths and contracts rather than duplicating their implementation in assertions.

Cover routing, complete result sets, entity resolution, request-context isolation, evidence selection, valid/invalid citations, malformed model responses, provider failures, and completion truncation. Add a reusable optional live evaluation command with explicit target/corpus identification, bounded requests, and provider pacing.

Record intent, entity/filter decisions, selected evidence IDs, answer, citations, configured/returned model metadata where available, finish status, and evaluation results. Do not log secrets or unnecessary private source content. The old baseline elapsed times include a corpus check and are not pure endpoint latency measurements.

Compare before/after correctness, completeness, groundedness, citation usefulness, and task fit separately. Repeat selected live cases when practical because generations vary. Do not claim a general accuracy improvement from one hand-selected run or use an LLM judge as unquestioned ground truth.

## Acceptance cases

Use the following as fixture expectations, not production constants:

- Inventory returns all five canonical fixture companies and a total of five. Adding a sixth fixture company changes the inventory and count correctly.
- CodeFlow AI is Passed. Its founders were praised; recorded concerns concern adoption, churn, distribution, and moat.
- LedgerLite has $1.8M ARR, 134% NRR, and 22 platform customers.
- FlowAI is Tracking. Its founders are Grace Lin and Raj Patel. The notes record approximately $9k MRR and approximately 55% month-two retention.
- FlowAI's recorded conditions are team/upmarket pricing and NRR above 110%, improving month-three retention, and reliability/observability. No numerical month-three retention threshold is recorded.
- Follow-ups after FlowAI remain about FlowAI. Ambiguous references request clarification. Separate conversations do not inherit one another's active company.
- FlowAI runway/burn and the unknown Orchid Robotics produce specific missing-evidence answers without unrelated citations.
- CloudBrain AI has three free design partners and $0 committed ARR in its deck; target ACV and fundraising requests are not achieved revenue.
- CloudBrain AI and VaultGuard have no recorded firm decision in their original decks. The demo README's historical Passed/Interested labels are not source gold; correct stale documentation without inventing source facts.
- Comparisons preserve ARR versus MRR, monthly paid logo churn versus cohort retention, approximation qualifiers, and source dates.
- No invented documents, invalid source IDs, unsupported later updates, or silently unfinished answers are returned.
- Existing upload, analyzer, company/dashboard views, and brief workflows continue to function.

## Environment and data protection

GitHub carries source files and evaluation evidence, not the local `.env`, Neon database contents, generated Prisma client, installed dependencies, or build output.

Use `.env.example` to configure a development environment privately. Prefer a dedicated development database or Neon branch. Never run schema changes or demo resets against the shared production database while implementing these fixes.

`npm run setup`, `npm run ingest:demo`, and the current seed entry point clear application data before re-ingestion. Do not run them merely to inspect or test the repository. Do not run `db:push`, destructive migrations, or a reset without an explicitly intended isolated target. The committed schema cleanup alone is not an instruction to drop tables in an existing database.

Do not request or embed secrets in chat, code, tests, logs, or commits. Default verification must work with fixtures/mocks without calling live services. Run optional provider-backed checks only with configured credentials, an identified appropriate corpus, and bounded usage.

## Completion requirements

Run the new relevant tests, `npm run lint`, and TypeScript checking. Run `npm run build` when the environment supports its prerequisites. If environment/network restrictions prevent a check, identify the exact check and limitation rather than marking it passed.

Update documentation and relevant stale comments to reflect the final implementation. Include setup and test commands for the next developer.

Before finishing, provide:

1. Each of the six scopes marked implemented, partially implemented, or deferred, with concrete file references.
2. Before/after results for the acceptance cases and preserved baseline strengths.
3. Checks actually run and their outcomes.
4. Remaining limitations and optional future experiments.
5. Focused local commit hashes using the preconfigured repository identity.

Do not claim that all six scopes are resolved until the application changes and corresponding verification exist.
