# Frontend audit implementation record

This change addresses the 30 frontend findings in the independent audit. The existing light editorial visual system is retained. The frontend changes preserve existing data. The subsequent durable-upload work requires an additive database upgrade before rollout; see [UPLOAD_IDEMPOTENCY.md](UPLOAD_IDEMPOTENCY.md). Frontend verification used isolated fixtures. During the authorized 25 November 2026 production rollout, the additive upload table was applied after a private backup; existing records were verified unchanged.

## Finding-by-finding changes

| Audit finding                  | Implementation                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 — Dashboard breakpoint      | Hero stays single-column below `xl`; proportional columns replace the fixed illustration track; actions can grow with wrapped labels.                   |
| 02 — Modal accessibility       | Shared native `Dialog` supplies naming, background inertness, focus entry/containment/restoration, Escape, scroll locking, and a scrollable drawer.     |
| 03 — Hidden brief failures     | Regeneration errors and retry appear inside the brief; previous content and generation time remain explicit.                                            |
| 04 — Ambiguous analyzer inputs | Explicit file/text modes, shared validation, a stable source snapshot, disabled pending edits, and cancellation.                                        |
| 05 — Nested keyboard controls  | Browse and Remove are separate native buttons.                                                                                                          |
| 06 — Upload queue              | One sequential worker, immediate queue rows, selection deduplication, validation, retry/remove/stop-waiting actions, and runtime response validation.   |
| 07 — Evidence verification     | Inline citations open collapsed evidence; document links open retained extracted text with validated exact-span highlighting and bounded text sections. |
| 08 — Route resilience          | Shared route loading, recoverable error, missing-record, and global-error views; dashboard data streams behind Suspense.                                |
| 09 — Taxonomy mismatch         | Facets use actual full-corpus values, merge casing variants, and filter case-insensitively without changing records.                                    |
| 10 — Filter race               | Local draft and one Apply submit the entire filter/search/sort state atomically.                                                                        |
| 11 — Accessible fields         | Persistent filter and analyzer labels, helper/error associations, and result-count feedback.                                                            |
| 12 — Contrast                  | Accessible semantic text colors, separate decorative accent, stronger field boundaries, and shared focus treatment.                                     |
| 13 — Workspace messaging       | Shared-workspace identity and pre-upload persistence/visibility disclosure replace the unconditional safe-sandbox assurance.                            |
| 14 — Request recovery          | Shared finite-deadline JSON transport, cancellation, retained input, retry, and stale-response guards.                                                  |
| 15 — Refresh loss              | Chat, analysis, and briefs offer explicit opt-in per-tab session saving. File bytes are never serialized; restored files require reselection.           |
| 16 — Long chat                 | Expanding textarea, sticky composer, reading-aware scrolling, latest-answer control, collapsed evidence, copying, and progressive transcript display.   |
| 17 — Accessible feedback       | Short live status/error messages and focus placement on completed analysis.                                                                             |
| 18 — Printing                  | Brief-only hiding is conditional on an open brief; ordinary pages retain printable content.                                                             |
| 19 — Long text                 | Shrinking flex/grid children and defensive wrapping cover names, filenames, evidence, reports, and shared lists.                                        |
| 20 — Company discovery         | Name search, explicit sorting, server pagination (24 per page), totals, ranges, and page links.                                                         |
| 21 — Missing categories        | Null/empty categories remain visible as Not recorded; totals reconcile and missing categories are filterable.                                           |
| 22 — Persistent navigation     | Sticky viewport-height desktop navigation and one document scroller.                                                                                    |
| 23 — Navigation dead ends      | Upload success, recent documents, company names, and document filenames link to their destinations.                                                     |
| 24 — Comparable claims         | Closest-retrieved wording, explicit no-comparables states, and removal of unexplained percent-match labels.                                             |
| 25 — Sparse/empty recovery     | Missing profile fields are explained; developer CLI and duplicate re-upload instructions are removed from product recovery.                             |
| 26 — Shared system             | Button, Alert, Dialog, DateTime, field/link styles, named layers/control sizes, rem typography, and the current `FRONTEND_DESIGN.md` contract.          |
| 27 — Frontend regressions      | Playwright workflows, axe checks, viewport screenshots, and focused request/validation/storage/date/URL tests.                                          |
| 28 — Navigation semantics      | Skip link, main target, named navigation, and programmatic current page.                                                                                |
| 29 — Titles/headings           | Route/company/document titles and a coherent directory heading hierarchy.                                                                               |
| 30 — Dates                     | Semantic dates, exact UTC details, labeled timestamp kinds, and future/invalid-date handling.                                                           |

## Verification

Run the Node suite, lint, and TypeScript checks:

```bash
npm test
npm run lint
npm run typecheck
```

Install the browser once, then run the frontend suite:

```bash
npx playwright install chromium
npm run test:frontend
```

If Google Chrome is already installed, the alternative is:

```bash
PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:frontend
```

The browser suite creates a disposable application snapshot on port 3101. It excludes `.env`, uses an in-memory read-only Prisma fixture, rejects unsupported database operations, and intercepts upload/AI requests. It does not run against production, change the active development server’s `.next` directory, or call live providers. Port 3101 must be available. Google font files may need to download on the first run.

Coverage includes viewport widths 320, 390, 768, 1024, 1280, 1440, and 2560; long names; drawer focus/Escape; brief regeneration and printing; analyzer source precedence, cancellation and restoration; queue ordering; combined filters; citation passage navigation; optional chat restoration; missing records; and database-error recovery. Screenshots and failure traces are generated under ignored `test-results/`.

After the security and durable-upload follow-up, the default Node suite passed 368 tests (the opt-in database parent is skipped by default), all 12 browser scenarios passed, and the separate PostgreSQL run passed its 9 database scenarios plus the parent/unit tests. Lint, TypeScript, 15 memory evaluations, and a clean-install production build also passed. Browser results use synthetic data and mocked AI outputs; they establish frontend behavior, not live model accuracy or a full WCAG conformance certification.

## Operational boundaries

- The shared per-file limit is 4 MiB, leaving multipart headroom below the standard Vercel Function request limit. Both clients and API validators read the same constant. Larger files require a separately implemented direct-storage upload path or a verified larger-body deployment configuration. See [Vercel request-body limits](https://vercel.com/docs/functions/limitations#request-body-size).
- Upload selection deduplication is now backed by durable server-side content identity, replay, leases, and fenced transactions after the additive database upgrade. Historical documents without byte fingerprints are not retroactively merged. Stopping a browser wait does not roll back ingestion. See [UPLOAD_IDEMPOTENCY.md](UPLOAD_IDEMPOTENCY.md).
- Per-tab saving is optional browser storage, not encryption or account isolation. Clear/uncheck removes the saved copy; a removal failure is reported explicitly. Browsers may restore session storage when reopening a previous session.
- The document reader serves retained extracted text. It does not invent original PDF layout, page numbers, or downloadable source binaries.
- The application remains a shared workspace. Account isolation, deletion/retention controls, a durable background worker, and a live provider/load/accessibility-device evaluation remain separate work. Request retries recover the same document, but this is not a background job runner.
- The follow-up dependency upgrade replaces the former 24-advisory state with zero known vulnerabilities at verification. See [SECURITY_UPGRADE.md](SECURITY_UPGRADE.md) for versions, compatibility changes, and verification limits.
- The additive production database upgrade was applied during the authorized 25 November 2026 rollout. Git history and GitHub deployment statuses identify the source release and deployment outcome. Existing records were preserved; no seed or reset command was run.
