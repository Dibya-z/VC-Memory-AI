# Architecture

VC Memory AI is a **RAG (retrieval-augmented generation)** application. The
differentiator is **memory**: every uploaded document contributes to a permanent,
queryable knowledge base, and every AI answer is grounded in the firm's real
history rather than generic knowledge.

---

## The core pipeline

```
        Document (PDF / TXT / MD)
                 │
                 ▼
        Text extraction                 lib/ingest/extract-text.ts
                 │
        ┌────────┴─────────┐
        ▼                  ▼
 AI structured       Chunking            lib/ingest/chunk.ts
 extraction          │
 lib/ai/extract.ts   ▼
        │         Embeddings             lib/embeddings (Voyage)
        ▼            │
 Company (memory)    ▼
 structured rows   Chunk + vector        Prisma (PostgreSQL)
        │            │
        └─────┬──────┘
              ▼
      Semantic retrieval                 lib/vector (cosine)
              │
              ▼
        LLM reasoning                    lib/ai (Groq · Llama 3.3 70B)
              │
              ▼
      Grounded response                  chat / analysis / brief
```

Two complementary stores are written on every ingest:

1. **Structured intelligence** (`Company`) — the durable "what we concluded"
   layer that powers filterable lists and exact-field display.
2. **Semantic index** (`Chunk` + embedding) — the fuzzy "what was said" layer that
   powers natural-language search and similarity comparison.

---

## Layers

| Layer | Path | Responsibility |
|---|---|---|
| **Pages (UI)** | `src/app/*/page.tsx` | Dashboard, Upload, Company Memory, Chat, Deal Analyzer |
| **API routes** | `src/app/api/*/route.ts` | Thin HTTP handlers → lib functions |
| **AI** | `src/lib/ai` | Extraction, chat, analysis, brief; prompts + Groq client |
| **Embeddings** | `src/lib/embeddings` | Voyage AI client (provider-swappable facade) |
| **Vector** | `src/lib/vector` | `VectorStore` interface + local cosine implementation |
| **Ingestion** | `src/lib/ingest` | Text extraction, chunking, end-to-end pipeline |
| **Data** | `src/lib/db` + `prisma` | Prisma client, queries, schema |
| **Config/types** | `src/config`, `src/lib/types.ts` | Enums, RAG params, shared types |

Each seam is an interface or a small module so pieces can be swapped:
- **LLM** — all calls go through `lib/ai/llm.ts` (provider + model IDs centralized).
- **Embeddings** — callers import `lib/embeddings`, not the Voyage file directly.
- **Vector store** — callers depend on the `VectorStore` interface; the default
  `LocalVectorStore` can be replaced with Chroma/Pinecone/pgvector with no
  caller changes.
- **Database** — Prisma 6 with PostgreSQL/Neon; development and production targets stay separate.

---

## Feature → code map

| Feature | Entry route | Core logic | UI |
|---|---|---|---|
| 1. Upload + ingestion | `POST /api/upload` | `ingest/pipeline` → `ai/extract` | `upload/page` + `Dropzone` |
| 2. Memory chatbot | `POST /api/chat` | `ai/chat` (RAG) | `chat/page` + `ChatWindow` |
| 3. New deal analysis | `POST /api/analyze` | `ai/analyze` + vector similarity | `analyzer/page` + `AnalysisReport`/`SimilarDeals` |
| 4. Investment brief | `POST /api/brief` | `ai/brief` | `companies/[id]` + `InvestmentBrief` |
| Dashboard | `GET /api/stats` | `db/queries` | `page` + `StatCard` |
| Company memory | `GET /api/companies` | `db/queries` | `companies/page` + `CompanyCard` |

---

## Data model

See [`prisma/schema.prisma`](./prisma/schema.prisma). Three models:

- **Company** — extracted structured intelligence (the memory). JSON fields hold
  arrays (`founders`, `strengths`, `risks`, `concerns`).
- **Document** — the original source text + metadata, retained in full.
- **Chunk** — embedded text slices; the RAG retrieval unit (`embedding` = JSON
  `number[]`).

Chat context is a bounded request payload; no conversation tables are required.

---

## Key design decisions

- **Full-stack Next.js over a separate Python backend** — one process, one deploy,
  fastest path to a working demo. Node has first-class Groq + Voyage clients.
- **Groq + Voyage for a $0 stack** — Groq's free tier (Llama 3.3 70B, no credit
  card) handles all reasoning; Voyage's free tier handles embeddings. The LLM
  seam (`lib/ai/llm.ts`) centralizes the provider, so swapping to Anthropic,
  OpenAI, or a local model later is a single-file change.
- **Local cosine vector search over a hosted vector DB** — at the
  hundreds/thousands-of-docs scale this is fast, free, and dependency-light, so
  the demo runs with only two API keys. The interface keeps the upgrade path open.
- **PostgreSQL/Neon** — retained company records, original documents, and vectors;
  default fixture tests use an injected repository without database access.
- **Structured extraction via JSON mode + Zod** — Groq JSON Object mode plus a
  Zod-validated retry yields clean, validated intelligence instead of brittle
  parsing. Strict schema decoding is currently disabled; Zod validates the output.
- **AI assists, never decides** — every recommendation uses hedged language
  ("Needs partner review", "Interesting signal", "Needs more diligence").

---

## Error handling (cross-cutting)

Handled at the ingestion and API boundaries:
- Empty / unreadable documents → clear "couldn't read this" message.
- Wrong file type / oversized file → rejected with reason (`config.UPLOAD`).
- AI / embedding failures → document marked `failed` with the error captured;
  the rest of the corpus is unaffected.
- Loading states surfaced per-file in the UI.

---

## Memory Chat

The request carries a bounded user/assistant history and optional active company.
The planner resolves references from user turns/catalog identity, validates its
allowlisted plan, and routes exact lists/counts to typed Prisma reads. Named
company questions read complete short sources within a 24,000-character evidence
budget. Comparisons divide the budget across companies. Semantic searches use
Voyage/cosine candidates with conservative lexical subject corroboration.

Each evidence item retains a stable ID, company/document identity, exact source
character offsets, source-date text when explicit, and separate upload metadata.
Generated fact/interpretation blocks require exact supporting quotes. The server
validates IDs, excerpts, output shape and finish metadata, then renders plain text
and only used citations. Truncated/invalid answers are withheld. Exact quote
provenance does not establish semantic entailment.

See [docs/MEMORY_CHAT.md](docs/MEMORY_CHAT.md) for contracts, verification, fixture
comparison with the baseline, live safety guards, and remaining limitations.
