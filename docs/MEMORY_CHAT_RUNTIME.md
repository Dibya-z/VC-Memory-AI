# Memory Chat runtime verification

Memory Chat must be checked against actual provider output as well as mocked regression fixtures. A mocked answer can establish that company routing, source selection and validation work without establishing that Groq will finish the requested answer or follow the citation contract.

The runtime work addresses completion budgets and model capabilities, passage-based source references, recoverable output failures, and duplicate error text. The implementation and its actual verification results should be reviewed together; a successful build or HTTP 200 is not evidence that a meeting-preparation answer is useful.

`memory-generation.ts` allows at most two generation attempts, with a 50-second
request budget and a maximum 22 seconds per provider attempt. SDK retries are
disabled for this path. Initial output budgets are 3,200 tokens for meeting
preparation and 2,200 for other generated tasks; a corrective attempt is capped
at 4,000. GPT-OSS uses low reasoning effort and a strict passage-ID schema.
Other configured models retain JSON-mode validation without unsupported options.

`memory-passages.ts` partitions retained text without normalization or discarded
separators. The model chooses short request-scoped `P1…` IDs; the server derives
canonical quotes and source offsets. Parent metadata plus source headings travel
with the passages, avoiding both duplicated full text and loss of context.
Legacy exact-quote responses remain validated for compatibility. Source checks
distinguish a suggestion to request an updated document from an assertion that
one exists. One clear failure message replaces the duplicated incomplete notice.

## Public-fixture provider smoke checks

The separate `eval:memory:provider` command runs the real `answerFromMemory` orchestrator and real Groq generator with the committed fictional fixture repository. It does not use scripted model responses, a Neon connection, or Voyage embeddings. Database URLs are replaced with inert values only inside that command's process, while all repository calls use the fixture adapter. It never loads or modifies live database content and does not run migrations, ingestion, or seeds.

Inspect the command without loading `.env` or application modules:

```bash
npm run eval:memory:provider -- --help
```

Provider use is refused by default. After configuring `GROQ_API_KEY` privately and choosing the desired existing `GROQ_MODEL_REASONING` override, explicitly opt in:

```bash
npm run eval:memory:provider -- --live \
  --cases meeting,facts,followup,unknown \
  --repeat 1 --pace-ms 21000 \
  --out /tmp/memory-provider-report.json
```

The report path must end in `.json` and must not already exist. CLI arguments are validated before environment loading; model configuration is imported after `.env` is loaded so the configured model is actually tested.

Available cases:

| Case | Request |
|---|---|
| `meeting` | `Prep me for a meeting with FlowAI.` |
| `facts` | LedgerLite's ARR, net revenue retention, and platform customer count. |
| `followup` | FlowAI founders and lean-in conditions, with a preceding user meeting-preparation turn. |
| `unknown` | Orchid Robotics founders and investment decision; should make no provider calls. |

Bounds are 1–3 repetitions, 20–60 seconds between orchestration calls, at most eight orchestration calls, and at most eight actual generator calls across the run. A case permits at most two generation attempts; SDK transport retries are disabled. Exhausting the provider budget records a failed case instead of issuing more requests. The command can exit unsuccessfully while still writing a report containing the completed cases.

Each case records its actual answer, citations, orchestration trace, provider invocation count, status, and source-span checks. The command checks that citations resolve to canonical text in the expected fictional company's sources, verifies expected completion/abstention behavior, and requires the diagnostic expected fields to be present. Review the full answer and cited sources for meaning, dates, approximation qualifiers, completeness and task fit; neither exact quotations nor field regexes prove that every paraphrase is supported.

The output contains public fictional answers and excerpts. Do not adapt the source inputs to private documents without separately considering where the provider sends them and where reports are saved.

## Default verification

```bash
npm test
npm run eval:memory
npm run lint
npm run typecheck
npm run build
```

Default tests include negative CLI checks proving that missing opt-in, invalid request bounds, missing credentials and unknown flags are handled before provider or database access. They never run the live provider smoke checks automatically. The generated Prisma client remains an import prerequisite for the real orchestrator; client generation does not connect to a database.

## Results and limits

During implementation on November 25, 2026, the original failure was reproduced
against real GPT-OSS-120B output: a 1,800-token completion hit its length cap,
including 1,453 reasoning tokens. A separate low-effort control finished but
generated non-contiguous quotes with ellipses, which exact-source validation
correctly rejected. Sanitized final-answer replays are committed in
`tests/fixtures/flowai-provider-replay.json`; no reasoning text or credentials
are retained.

An initial provider smoke run completed all runtime/citation checks but source
review found that a follow-up omitted the people named in the note. Carrying
each passage's actual source heading and company identity corrected that case;
the follow-up returned Grace Lin and Raj Patel with their recorded roles and
qualified that the note does not separately establish founder designations.
Field-presence checks now fail the smoke command for such omissions rather
than treating successful completion as sufficient.

The exact meeting-preparation question also completed on three paced localhost
requests, each on the first generation attempt with canonical citations. These
checks read the existing FlowAI memory without writing to the database. The
production build was verified in an isolated source snapshot with inert database
URLs, leaving the active development server's build output intact.

The final implementation passed **338 tests**, the **15-case fixture evaluation**,
lint, TypeScript checking, whitespace checks and the isolated production build.
The [recorded real-provider smoke report](evaluations/memory-chat-runtime-2026-11-25.json)
passed all four cases on `openai/gpt-oss-120b`: meeting preparation, LedgerLite
metrics, the FlowAI follow-up and an unknown company. Three actual generation
requests were needed; the unknown-company case made none. Every returned
citation matched its canonical source span, and expected field checks passed.

Missing extracted decision reasons are omitted from current-record evidence
instead of rendering a bare “not recorded” value that can be confused with
document-wide absence. Historical metrics are explicitly requested with their
source dates. These refinements preserve the original source text and data.

Small selected samples do not establish a general accuracy percentage or
guarantee future model behavior. Semantic source support still requires review;
source titles and leader names can justify reporting recorded participants with
qualification rather than asserting an unrecorded ownership designation.
