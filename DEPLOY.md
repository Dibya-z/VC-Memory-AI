# Deploying VC Memory AI (Vercel + Neon)

Goal: a public link a reviewer can use immediately, **pre-loaded with demo data**,
at **$0 with no credit card**.

- **App hosting:** Vercel (free Hobby tier) — native home for Next.js.
- **Database:** Neon (free Postgres tier, no card) — persists the seeded memory.
- **AI:** your existing Groq + Voyage free-tier keys.

Because chunk embeddings are stored in the database during seeding, the live app
only computes a single **query** embedding per chat/analyze/brief — comfortably
under Voyage's free-tier rate limit. Reviewers won't hit a backoff.

---

## 1. Create the Neon database (5 min)

1. Sign up at <https://neon.tech> (GitHub login, no card).
2. Create a project (any name; pick the region closest to you).
3. Open **Dashboard → Connect** and copy **two** connection strings:
   - **Pooled** (host contains `-pooler`) → this is your `DATABASE_URL`.
   - **Direct** (no `-pooler`) → this is your `DIRECT_URL`.
     Make sure both end with `?sslmode=require`.

---

## 2. Prepare an isolated development Neon branch

Verify a dedicated development database or Neon branch in the provider dashboard.
Keep its credentials separate from production, then edit local `.env` (see `.env.example`):

```bash
DATABASE_URL="postgresql://...-pooler...neon.tech/...?sslmode=require"   # pooled
DIRECT_URL="postgresql://...neon.tech/...?sslmode=require"               # direct
GROQ_API_KEY="gsk_..."
VOYAGE_API_KEY="pa-..."
```

Only on that verified development target, create tables and load the demo corpus.
`setup`, `ingest:demo`, and `db:seed` clear existing application data:

```bash
npx prisma generate          # regenerate client for the postgresql provider
npm run db:push              # create tables in Neon (uses DIRECT_URL)
npm run ingest:demo          # seed 5 companies + embeddings (one-time Voyage cost)
```

`ingest:demo` pauses a couple of times on Voyage's free-tier rate limit — that's
expected; let it finish. When it prints "5 past deals are now in memory", your
Neon DB is ready.

> Sanity check: `npm run dev` at localhost:3001 now reads from the development branch — the dashboard should
> show 5 companies and Memory Chat should answer.

---

## 3. Push to GitHub

```bash
git add -A
git commit -m "chore: postgres + demo mode for hosted deploy"
git push
```

(`.env` is git-ignored — your keys are not committed.)

---

## 4. Deploy on Vercel

1. Sign in at <https://vercel.com> (GitHub login, no card). Use Node 24 for the verified toolchain.
2. **Add New → Project →** import the `VC-Memory-AI` repo. Framework is
   auto-detected as **Next.js**; leave the build settings default
   (build command `npm run build` already runs `prisma generate`).
3. Before the first deploy, add **Environment Variables** (Production + Preview):

   | Name             | Value                  |
   | ---------------- | ---------------------- |
   | `DATABASE_URL`   | Neon **pooled** string |
   | `DIRECT_URL`     | Neon **direct** string |
   | `GROQ_API_KEY`   | your Groq key          |
   | `VOYAGE_API_KEY` | your Voyage key        |

4. Before deploying this revision against an existing database, apply the reviewed
   additive upload-idempotency SQL to the verified target. See
   [the upgrade and rollback instructions](docs/UPLOAD_IDEMPOTENCY.md).
   Avoid ingestion through the old version during the rollout so untracked legacy
   uploads are not introduced. The additive table was applied to the authorized
   production target during the 25 November 2026 rollout; existing company,
   document, and chunk records were verified unchanged. Other databases still
   need the same reviewed upgrade before deploying this revision.
5. **Deploy.** When it finishes you get a `https://<project>.vercel.app` link.

The reviewer opens that link and lands on a populated dashboard — no setup, no
files required. They can use the sample decks in **Deal Analyzer** and **Upload**,
and ask **Memory Chat** anything.

---

## Notes & gotchas

- **Function timeout:** chat, analysis, and brief routes request a 60-second
  maximum; uploads request 120 seconds for provider work plus database claim and
  finalization headroom. Confirm that the selected hosting plan supports these
  durations.
- **Separate development and production.** Local work and evaluations must use a
  dedicated development database or Neon branch. Verify both connection targets
  before using any schema or ingestion command.
- **Destructive demo loading:** `setup`, `ingest:demo`, and `db:seed` clear data.
  Never run them against a shared production database to inspect or test changes.
- Production data changes and deployments require an explicit operational plan.
  The optional Memory Chat evaluation only reads, and refuses unverified targets;
  see [docs/MEMORY_CHAT.md](docs/MEMORY_CHAT.md).
- Keep PostgreSQL/Neon as configured; fixture tests need no schema changes.

## Frontend upload and workspace contract

The shared per-file limit is **4 MiB** for the current multipart upload and analyzer
routes. This leaves headroom under the standard Vercel Function request-body
limit; the UI submits upload queue items one at a time. Do not raise the constant
without verifying the deployment body limit or implementing direct object-storage
uploads. See [Vercel Function limits](https://vercel.com/docs/functions/limitations#request-body-size).

This application currently exposes a shared workspace rather than account-isolated
storage. The interface discloses persistence before uploads. Chat, analysis, and
brief browser saving is opt-in session storage; it does not change server access
controls. See [the frontend verification record](docs/FRONTEND_AUDIT_RESOLUTION.md).
