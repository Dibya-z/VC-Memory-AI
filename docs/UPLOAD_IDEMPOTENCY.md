# Durable upload idempotency

Uploads now have a database-backed identity. Repeated or concurrent uploads of the same bytes and supported parser format reuse one document rather than starting independent ingestion writes. This applies to the current shared workspace; a future account/workspace system must include workspace identity in the key.

## Identity and processing contract

`uploadContentKey()` computes SHA-256 on the original bytes, namespaced by `upload-v1` and validated file type (`pdf`, `txt`, or `md`). Filenames, browser modification times, request IDs, and wall-clock upload times are not part of the identity. A renamed byte-identical `.md` file therefore reuses the same document, while a changed file or different parser format has a different key.

`UploadIngestion.key` is the durable primary key. Its unique document relation points to one document throughout processing, retries, and replay. The initial unlinked document has `status=processing`; source text, company association, intelligence, and chunks are published only when finalization succeeds.

- **First claim:** A short transaction serializes claim creation with a PostgreSQL transaction advisory lock. It creates the job and document together before parsing or AI calls.
- **Still processing:** A request with an active claim returns a per-file `pending: true`, a safe explanation, and `retryAfterSeconds` between 1 and 120. It does not call parsers or providers.
- **Completed replay:** The server reads the processed document and its validated intelligence, returns the original document/company IDs, and sets `reused: true`. It does not call parsers or providers or change company timestamps.
- **Failed or abandoned attempt:** The retry takes ownership of the same document with a new token and increments the attempt counter. The first claim's observation time remains stable.

Claims have a 120-second lease measured by the database's actual UTC clock. The owner renews between processing stages; a superseded or expired token cannot renew, fail, or finalize a job. Owner checks happen after acquiring row locks, so waiting for a lock cannot revive a lease that expired during the wait. The server waits at most 45 seconds across parsing/provider stages; the upload route allows additional database transaction headroom. An underlying provider request may finish later, but its late result cannot resume the failed attempt or publish memory.

All final writes happen inside one short transaction: lock and fence the job, lock the normalized company identity, merge company memory, link the retained text/intelligence, replace that document's chunks, and mark both document and job complete. The final lease check rolls back all those writes if ownership expires during finalization. Different documents for the same company use the same company advisory lock to prevent duplicate creation and lost array updates through this ingestion path. Repository transactions explicitly use PostgreSQL Read Committed isolation, ensuring reads after that lock see the previous writer’s commit even if the supplied Prisma client defaults to Repeatable Read.

Provider calls occur outside database transactions. A timeout, process termination, or lost response can cause external provider work to be repeated after recovery. The guarantee is one committed document/index per upload identity and fenced database writes, **not exactly-once provider billing**. Stopping a browser wait does not roll back completed ingestion.

## Existing data

This change does not delete or merge historical records. Existing documents have no original-byte hash; the retained normalized PDF text cannot reliably reconstruct it. The first re-upload of an older document may create one new tracked document, after which byte-identical retries are deduplicated. Existing duplicate records require a separate reviewed cleanup plan.

The identity is stable across deployments and model settings. Do not bump `upload-v1` for ordinary releases. Intentional re-extraction needs an explicit reprocessing/versioning design so that existing provenance remains clear.

## Database upgrade before deployment

The additive change was first tested on disposable PostgreSQL, then applied to the authorized production database during the 25 November 2026 rollout. A private backup was created outside Git, and all existing company, document, and chunk records were verified unchanged. For another database, apply the same reviewed upgrade before deploying the new ingestion code. The SQL is:

`prisma/changes/20261125_upload_idempotency.sql`

The repository previously used `prisma db push` and has no migration baseline. Do not introduce `migrate reset` or blindly run a first migration against an existing production database. The supplied script only creates the new table, foreign key, and indexes; it leaves existing company/document/chunk data intact and can be reapplied when the expected table already exists.

Review the SQL and back up the intended database first. Load a verified isolated database configuration to rehearse it, then have the maintainer verify the production/direct target before applying the same additive change. With the repository's Prisma 6 CLI, the application command is:

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/changes/20261125_upload_idempotency.sql
npx prisma generate
```

The first command changes the database selected by the loaded schema/environment configuration. It must not be run with an unverified `.env`. Confirm the endpoint/database in the provider console rather than printing secrets to a terminal. New installations can create the full current schema on an empty isolated database using the normal setup workflow.

Apply the additive table before deploying the new ingestion code. If the table is missing, upload claims fail closed with an actionable availability message; the server does not silently fall back to duplicate-prone writes. Existing read-only features do not need the new relation to serve company records.

Rollback of application code does not require dropping the new table. Retaining it preserves identity history. Dropping it would lose replay protection, so any database rollback must be reviewed separately.

## Verification

Default fixture tests make no database or provider calls:

```bash
npm run test:ingestion
```

The opt-in PostgreSQL suite requires an explicitly provisioned disposable database named `vc_memory_idempotency_test` on `127.0.0.1`. It rejects other targets, uses fake providers, and deletes only its own generated fixture rows:

```bash
# Set INGESTION_TEST_DATABASE_URL to that disposable loopback database.
npm run test:ingestion:db
```

Rehearse the additive script against an existing-schema fixture before running those tests. Coverage includes parallel requests, completed replay, failed-provider retry on the same document, lease takeover and stale-worker rejection, lease expiry during row/company lock waits, transaction rollback, and concurrent merges from different documents about the same company, including two writers held behind the same lock with caller-default Repeatable Read isolation. These are real PostgreSQL transaction checks, not claims that an in-memory mock proves distributed correctness.
