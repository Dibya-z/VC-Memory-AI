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

## 2. Point local env at Neon and seed it (5–10 min)

Edit your local `.env` (see `.env.example`):

```bash
DATABASE_URL="postgresql://...-pooler...neon.tech/...?sslmode=require"   # pooled
DIRECT_URL="postgresql://...neon.tech/...?sslmode=require"               # direct
GROQ_API_KEY="gsk_..."
VOYAGE_API_KEY="pa-..."
```

Then create the tables and load the demo corpus **into Neon**:

```bash
npx prisma generate          # regenerate client for the postgresql provider
npm run db:push              # create tables in Neon (uses DIRECT_URL)
npm run ingest:demo          # seed 5 companies + embeddings (one-time Voyage cost)
```

`ingest:demo` pauses a couple of times on Voyage's free-tier rate limit — that's
expected; let it finish. When it prints "5 past deals are now in memory", your
Neon DB is ready.

> Sanity check: `npm run dev` locally now reads from Neon — the dashboard should
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

## 4. Deploy on Vercel (5 min)

1. Sign in at <https://vercel.com> (GitHub login, no card).
2. **Add New → Project →** import the `VC-Memory-AI` repo. Framework is
   auto-detected as **Next.js**; leave the build settings default
   (build command `npm run build` already runs `prisma generate`).
3. Before the first deploy, add **Environment Variables** (Production + Preview):

   | Name             | Value                                   |
   | ---------------- | --------------------------------------- |
   | `DATABASE_URL`   | Neon **pooled** string                  |
   | `DIRECT_URL`     | Neon **direct** string                  |
   | `GROQ_API_KEY`   | your Groq key                           |
   | `VOYAGE_API_KEY` | your Voyage key                         |

4. **Deploy.** When it finishes you get a `https://<project>.vercel.app` link.

The reviewer opens that link and lands on a populated dashboard — no setup, no
files required. They can use the sample decks in **Deal Analyzer** and **Upload**,
and ask **Memory Chat** anything.

---

## Notes & gotchas

- **Function timeout:** the four AI routes (`/api/chat`, `/api/analyze`,
  `/api/brief`, `/api/upload`) export `maxDuration = 60` so LLM calls don't hit
  Vercel's 10s default. Groq is fast, so this is just headroom.
- **Local dev and prod share one Neon DB.** The seed resets data each run, so
  re-running `npm run ingest:demo` cleans it anytime. If you'd rather isolate
  dev, create a Neon **branch** and use its URLs locally.
- **Re-seeding production:** run `npm run ingest:demo` locally with `.env`
  pointed at Neon — it updates the same database the live app reads.
- **Reviewers uploading samples** adds companies to the shared demo DB. Harmless;
  re-seed to reset to the canonical 5.
- **Switching back to SQLite for offline dev** (optional): set
  `provider = "sqlite"` and `DATABASE_URL="file:./dev.db"`, remove `directUrl`,
  then `npm run db:push && npm run ingest:demo`. Keep the repo on `postgresql`
  for Vercel.
