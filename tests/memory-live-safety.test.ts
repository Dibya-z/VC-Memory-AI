import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { corpusFingerprint, databaseFingerprint, identifyDatabaseTarget } from "../scripts/lib/memory-live-safety";

const pooled = "postgresql://role:private-secret@ep-dev-123-pooler.eu-central-1.aws.neon.tech/memory_dev?sslmode=require";
const direct = "postgresql://different-role:another-private-secret@ep-dev-123.eu-central-1.aws.neon.tech:5432/memory_dev?sslmode=verify-full";
function environment(): NodeJS.ProcessEnv {
  return { DATABASE_URL: pooled, DIRECT_URL: direct, MEMORY_CHAT_ENV: "development",
    MEMORY_CHAT_ISOLATED_DATABASE: "true", MEMORY_CHAT_TARGET_LABEL: "isolated memory-chat development branch",
    MEMORY_CHAT_DATABASE_FINGERPRINT: databaseFingerprint(pooled), NODE_ENV: "test" };
}

test("Neon pooled and direct identities match without credentials/query parameters", () => {
  const expected = createHash("sha256").update("ep-dev-123.eu-central-1.aws.neon.tech:5432/memory_dev").digest("hex");
  assert.equal(databaseFingerprint(pooled), expected);
  assert.equal(databaseFingerprint(direct), expected);
  assert.deepEqual(identifyDatabaseTarget(environment()), { fingerprint: expected, label: "isolated memory-chat development branch" });
});

test("target identity includes database name, hostname and non-default port", () => {
  const fingerprint = databaseFingerprint(direct);
  for (const url of [direct.replace("memory_dev", "other_database"), direct.replace("ep-dev-123.", "ep-other-123."),
    direct.replace(":5432/", ":5433/")]) assert.notEqual(databaseFingerprint(url), fingerprint);
  assert.equal(databaseFingerprint("postgres://localhost/a%20b"), databaseFingerprint("postgresql://localhost:5432/a%20b"));
  assert.notEqual(databaseFingerprint("postgresql://example-pooler.test/db"), databaseFingerprint("postgresql://example.test/db"));
});

test("missing development attestations always refuse live evaluation", () => {
  for (const [key, values] of [
    ["MEMORY_CHAT_ENV", [undefined, "production", "test"]],
    ["MEMORY_CHAT_ISOLATED_DATABASE", [undefined, "false", "TRUE"]],
    ["MEMORY_CHAT_DATABASE_FINGERPRINT", [undefined, "", "0".repeat(64)]],
    ["DATABASE_URL", [undefined]], ["DIRECT_URL", [undefined]],
  ] as const) {
    for (const value of values) assert.throws(() => identifyDatabaseTarget({ ...environment(), [key]: value }), key);
  }
});

test("production process and deployment environments refuse even with affirmative flags", () => {
  assert.throws(() => identifyDatabaseTarget({ ...environment(), NODE_ENV: "production" }), /non-production/);
  assert.throws(() => identifyDatabaseTarget({ ...environment(), VERCEL_ENV: "production" }), /non-production/);
});

test("unlabeled, production-labeled and credential-shaped target labels are rejected", () => {
  for (const label of [undefined, "", "dev", "production", "shared-prod-clone", "prod_dev", "https://user:secret@host", "dev\nunsafe"]) {
    assert.throws(() => identifyDatabaseTarget({ ...environment(), MEMORY_CHAT_TARGET_LABEL: label }), /TARGET_LABEL/);
  }
});

test("mismatched pooled/direct identities refuse evaluation without exposing URLs", () => {
  const other = direct.replace("memory_dev", "production_database");
  assert.throws(() => identifyDatabaseTarget({ ...environment(), DIRECT_URL: other }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /different database targets/);
    assert.doesNotMatch(error.message, /private-secret|another-private-secret|postgresql:\/\//);
    return true;
  });
});

test("malformed or non-PostgreSQL URLs fail without echoing credentials", () => {
  for (const url of ["private-secret", "https://role:private-secret@example.com/db", "postgresql://role:private-secret@example.com/", "postgresql://host/%zz"]) {
    assert.throws(() => databaseFingerprint(url), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /private-secret/);
      return true;
    });
  }
});

test("corpus fingerprint ignores input order but detects changed, renamed, added and duplicate documents", () => {
  const a = { filename: "a.md", rawText: "Private source A" }, b = { filename: "b.txt", rawText: "Private source B" };
  const fingerprint = corpusFingerprint([a, b]);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint, corpusFingerprint([b, a]));
  assert.notEqual(fingerprint, corpusFingerprint([a, { ...b, rawText: "Changed source" }]));
  assert.notEqual(fingerprint, corpusFingerprint([a, { ...b, filename: "renamed.txt" }]));
  assert.notEqual(fingerprint, corpusFingerprint([a]));
  assert.notEqual(fingerprint, corpusFingerprint([a, a, b]));
});
