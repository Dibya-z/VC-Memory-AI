# VC Memory AI

**An AI second brain for lean venture capital teams.**

A lean VC firm evaluates hundreds of startups a year and generates a huge amount
of valuable knowledge — pitch decks, meeting notes, memos, rejection reasons. But
it scatters across PDFs, docs, email, and personal notes, and the firm slowly
loses its **institutional memory**.

When a founder comes back a year later — _"we've grown 10x"_ — the team needs to
instantly recall: did we meet them? What did we think? Why did we pass? What were
our concerns? Has anything changed?

VC Memory AI turns every document into permanent, searchable memory, then lets
the team **chat with it**, **compare new deals against past ones**, and
**generate partner-ready briefs**. The goal isn't to replace investor judgment —
it's to remove repetitive information-retrieval work so investors spend more time
making judgments.

---

## What it does

1. **Document upload + ingestion** — drop in pitch decks (PDF), memos, and notes.
   AI extracts structured investment intelligence (sector, stage, founders,
   traction, strengths, risks, concerns, and the decision + reason).
2. **VC Memory chatbot** — _"Show me all AI startups we passed on for GTM
   concerns"_ or _"Prep me for tomorrow's FlowAI meeting."_ Answers are grounded
   in the firm's real history, with citations.
3. **New deal analysis + memory comparison** — upload a new deck; get an analysis
   **and** the most similar past deals (what we concluded then, why it matters
   now).
4. **Investment brief generation** — a clean, partner-ready memo with hedged
   recommendation language (the AI never makes the final call).

---

## Tech stack

- **Next.js 14 (App Router) + TypeScript** — unified full-stack app (UI + API).
- **Tailwind CSS + shadcn/ui** — professional, minimal VC SaaS UI (Linear/Notion).
- **Prisma + SQLite** — zero-config local DB; swap to Postgres for production.
- **Groq (`groq-sdk`)** — `llama-3.3-70b-versatile` for extraction/analysis/
  briefs; `llama-3.1-8b-instant` for cheap helpers. Free tier, no credit card.
- **Voyage AI (`voyage-3.5`)** — vector embeddings for semantic search/RAG.
- **Local vector store** — cosine similarity over Prisma-stored embeddings,
  behind a `VectorStore` interface (swap for Chroma/Pinecone/pgvector later).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design and RAG pipeline.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure keys
cp .env.example .env        # add GROQ_API_KEY and VOYAGE_API_KEY (both free)

# 3. Create the DB, seed demo data, and ingest the sample documents
npm run setup               # = prisma db push && db:seed && ingest:demo

# 4. Run
npm run dev                 # http://localhost:3000
```

Useful scripts: `npm run db:studio` (browse the DB), `npm run db:push` (apply
schema), `npm run ingest:demo` (re-ingest the demo corpus).

---

## Status

Scaffold stage — architecture and file structure are in place; feature logic is
stubbed with `TODO(impl)` markers at each seam. Build order is documented in
[ARCHITECTURE.md](./ARCHITECTURE.md#build-plan).
