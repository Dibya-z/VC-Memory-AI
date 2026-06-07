# VC Memory AI — Case Study Note

**Live demo:** https://vc-memory-ai.vercel.app (pre-loaded with demo data — no files needed)
**Code:** https://github.com/Dibya-z/VC-Memory-AI

---

## The problem, and who it's for

A lean VC team meets hundreds of startups a year. Every deck, founder call, memo,
and rejection generates real knowledge — but it scatters across PDFs, docs, inboxes,
and someone's head. The firm slowly loses its own **institutional memory**.

The moment it hurts: a founder you passed on comes back a year later — *"we've 10x'd."*
Did we meet them? What did we conclude? **Why** did we pass? Has the concern been
addressed? Today that means digging through Drive and Slack, or relying on whoever
happens to remember. It's for **small investment teams with no dedicated ops/knowledge
function** — exactly the lean team in the brief. The goal is explicitly *not* to make
investment decisions; it's to remove repetitive retrieval so partners spend time judging.

## What I built

**VC Memory AI** turns every document into durable, queryable memory:

1. **Ingestion** — drop a deck/memo/notes (PDF, txt, md); the model extracts structured
   intelligence: sector, stage, founders, traction, strengths, risks, concerns, and the
   **decision + the reasoning behind it**. Multiple docs on one company *accumulate* into a
   single memory rather than overwriting.
2. **Memory Chat (RAG)** — ask in plain language ("which startups did we pass on, and why?",
   "prep me for the FlowAI meeting"). Answers are grounded in real records, with citations.
3. **Deal Analyzer** — paste a new deck; it surfaces the most similar past deals **and what
   the firm concluded then** (decision + reasoning + % match). The comparison is the payoff.
4. **Investment Brief** — a one-click partner-ready memo for any company in memory.

A deliberate product rule runs through all of it: **the AI assists, it never decides.**
Recommendations stay hedged ("worth a closer look", "needs partner review").

## Tools & models, and why

- **Next.js 14 (App Router) + TypeScript** — one codebase for UI and API; fastest path to a
  real, deployable full-stack app.
- **Groq + Llama 3.3 70B** for reasoning (extraction, analysis, briefs); **Llama 3.1 8B** for
  light tasks. I originally planned to use Claude, but the self-imposed constraint was to run
  the whole thing at **$0 with no credit card** — Groq's free tier needs no card and is very
  fast. The LLM sits behind a thin client, so swapping to Claude/GPT later is a one-line change.
- **Voyage `voyage-3.5`** for embeddings (strong quality, free tier).
- **Local cosine-similarity vector store** over embeddings stored in Postgres, behind a
  `VectorStore` interface — no extra infra for a prototype, swappable for pgvector/Pinecone.
- **Prisma + Postgres (Neon)**, deployed on **Vercel** — both free, no card.

## What I tried that didn't work

- **SQLite on serverless.** I built locally on SQLite (zero-config), but Vercel's filesystem is
  ephemeral and read-only — the seeded memory vanished on deploy. I migrated to Neon Postgres and
  now **pre-seed embeddings** so the live app only embeds the *query* at runtime.
- **Free-tier rate limits were the real bottleneck — not the AI.** Voyage caps ~3 requests/min
  without a card (I added retry/backoff + batched embedding), and Groq enforces a daily token cap
  (I added graceful "try again shortly" handling instead of raw errors).
- **Routing chat to the cheaper 8B model** to save tokens — it blurred decision states (called a
  *Tracking* deal *passed*). Since accurate memory is the entire value proposition, I reverted to
  70B. Lesson: don't trade away correctness on the one thing the product is supposed to be good at.
- **Image-only PDFs** can't be parsed (no OCR), so I detect and return a clear error rather than
  silently storing garbage.

## What I'd do differently / extend with more time

- **A portfolio-relationship layer.** The brief also mentions managing portfolio relationships,
  which I underweighted. I'd track founder interactions over time and surface "who haven't we
  spoken to in 90 days."
- **Passive ingestion via connectors** (email, calendar, Notion, Affinity) so memory builds
  itself instead of relying on manual upload.
- **A "what we don't know yet" lens** on analysis (explicit information gaps), and an **eval
  harness** to measure grounding/citation accuracy rather than eyeballing it.
- **Productionizing:** auth + multi-user, OCR for scanned decks, a managed vector store at scale,
  and routing the heavy reasoning to a stronger model (Claude/GPT) where a budget exists.

The honest summary: the AI was the easy part. Most of my time went into the boring, real
constraints — persistence, rate limits, and keeping the model's claims tightly grounded so the
"memory" is trustworthy.
