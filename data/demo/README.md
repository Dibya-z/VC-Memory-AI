# Demo dataset

Sample fake VC documents that make the product work immediately and let the
memory-comparison features shine. These are ingested by `npm run ingest:demo`
(or `npm run setup`).

The set is designed so the demo can show **memory in action** — e.g. uploading a
new AI coding assistant deck (DevAI) surfaces the previously-passed CodeFlow AI.

Committed fictional documents (source documents are the authority for historical decisions):

| File | Company | Sector | Stage | Decision | Type |
|---|---|---|---|---|---|
| `cloudbrain-ai-deck.md` | CloudBrain AI | AI Infrastructure | Seed | Not recorded in deck | pitch deck |
| `codeflow-ai-memo.md` | CodeFlow AI | Developer Tools | Seed | Passed (weak team adoption) | investment memo |
| `ledgerlite-memo.md` | LedgerLite | Fintech | Series A | Invested | investment memo |
| `flowai-notes.txt` | FlowAI | SaaS | Seed | Tracking (pricing + retention concerns) | founder notes |
| `vaultguard-deck.md` | VaultGuard | Cybersecurity | Seed | Not recorded in deck | pitch deck |
| `devai-newdeal.md` | DevAI | Developer Tools | Seed | _(none — new deal for the analyzer demo)_ | pitch deck |

> These are illustrative documents written for the case study — not real companies.

`devai-newdeal.md` is analyzer input; the demo ingest loads the other five.
`setup`, `ingest:demo`, and `db:seed` clear application data. Run them only against
an intentionally isolated development target. Regression tests read these files
as fixtures without ingestion, database access, or provider calls.
