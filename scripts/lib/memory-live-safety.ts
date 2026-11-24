import { createHash } from "node:crypto";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Parse identity without retaining or reporting credentials or connection query parameters. */
function canonicalDatabaseTarget(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid PostgreSQL database URL is required; the supplied value has been withheld.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
    url.pathname === "/" || !url.pathname) {
    throw new Error("The database URL must identify a PostgreSQL host and database.");
  }
  let database: string;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("The database URL has an invalid encoded database name.");
  }
  let hostname = url.hostname.toLowerCase();
  if (hostname.endsWith(".neon.tech")) hostname = hostname.replace(/-pooler(?=\.)/, "");
  return `${hostname}:${url.port || "5432"}/${database}`;
}

/** Offline identity inspection; never opens a database connection. */
export function databaseFingerprint(url: string): string {
  return sha256(canonicalDatabaseTarget(url));
}

/**
 * Enforces a separately verified development-target attestation. Matching URL
 * identities and a fingerprint prevent accidental target drift, but cannot
 * prove that a remote Neon branch is isolated: that fact must be verified in
 * the database provider before setting these opt-in environment variables.
 */
export function identifyDatabaseTarget(env: NodeJS.ProcessEnv): { fingerprint: string; label: string } {
  if (env.MEMORY_CHAT_ENV !== "development" || env.MEMORY_CHAT_ISOLATED_DATABASE !== "true" ||
    env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("Live evaluation requires an explicitly attested isolated development database and a non-production environment.");
  }
  const label = env.MEMORY_CHAT_TARGET_LABEL?.trim() ?? "";
  if (label.length < 4 || label.length > 80 || !/^[a-z0-9][a-z0-9 _./:-]*$/i.test(label) ||
    /(?:^|[^a-z])prod(?:uction)?(?:$|[^a-z])/i.test(label)) {
    throw new Error("MEMORY_CHAT_TARGET_LABEL must descriptively identify a development target and contain no production label or credentials.");
  }
  if (!env.DATABASE_URL || !env.DIRECT_URL) {
    throw new Error("Both DATABASE_URL and DIRECT_URL are required to verify the development target.");
  }
  const fingerprint = databaseFingerprint(env.DATABASE_URL);
  if (databaseFingerprint(env.DIRECT_URL) !== fingerprint) {
    throw new Error("Pooled and direct database URLs identify different database targets; live evaluation was refused.");
  }
  if (!/^[a-f0-9]{64}$/i.test(env.MEMORY_CHAT_DATABASE_FINGERPRINT ?? "") ||
    env.MEMORY_CHAT_DATABASE_FINGERPRINT?.toLowerCase() !== fingerprint) {
    throw new Error("The current database target does not match MEMORY_CHAT_DATABASE_FINGERPRINT; inspect and verify the isolated development target first.");
  }
  return { fingerprint, label };
}

/** Stable corpus identity without returning or logging private document contents. */
export function corpusFingerprint(documents: { filename: string; rawText: string }[]): string {
  const sorted = documents.map(({ filename, rawText }) => ({ filename, contentHash: sha256(rawText) }))
    .sort((a, b) => a.filename < b.filename ? -1 : a.filename > b.filename ? 1 :
      a.contentHash < b.contentHash ? -1 : a.contentHash > b.contentHash ? 1 : 0);
  return sha256(JSON.stringify(sorted));
}
