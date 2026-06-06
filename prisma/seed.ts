/**
 * Database seeder. Delegates to the demo corpus loader so `npm run db:seed`,
 * `prisma db seed`, and `prisma migrate reset` all populate the same realistic
 * memory the app ships with.
 *
 * The canonical implementation lives in scripts/ingest-demo.ts — it runs the
 * demo documents through the REAL ingestion pipeline so embeddings exist for
 * search (rather than inserting hand-written rows). Importing it here triggers
 * that run; needs GROQ_API_KEY + VOYAGE_API_KEY in .env.
 */

import "../scripts/ingest-demo";
