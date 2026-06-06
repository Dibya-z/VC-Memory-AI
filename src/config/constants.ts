/**
 * App-wide enumerations and constants. Kept in one place so the UI filters,
 * extraction prompts, and validators all agree on the same vocabulary.
 */

export const SECTORS = [
  "AI Infrastructure",
  "Developer Tools",
  "Fintech",
  "Healthcare",
  "SaaS",
  "Cybersecurity",
  "Data & Analytics",
  "Consumer",
  "Marketplace",
  "Other",
] as const;
export type Sector = (typeof SECTORS)[number];

export const STAGES = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Growth",
  "Unknown",
] as const;
export type Stage = (typeof STAGES)[number];

export const DECISIONS = [
  "Interested",
  "Passed",
  "Invested",
  "Tracking",
] as const;
export type Decision = (typeof DECISIONS)[number];

export const DOC_TYPES = [
  "pitch_deck",
  "memo",
  "notes",
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** File upload constraints (enforced in the upload route + Dropzone). */
export const UPLOAD = {
  ACCEPTED_EXTENSIONS: [".pdf", ".txt", ".md"] as const,
  ACCEPTED_MIME: ["application/pdf", "text/plain", "text/markdown"] as const,
  MAX_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
} as const;

/** RAG retrieval defaults. */
export const RAG = {
  CHUNK_SIZE: 1200, // ~chars per chunk
  CHUNK_OVERLAP: 200,
  TOP_K: 8, // chunks retrieved per query
} as const;
