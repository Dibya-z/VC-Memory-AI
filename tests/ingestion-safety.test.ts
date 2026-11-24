import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

// These targets must be rejected before launching a client or loading application .env.
test("database test launcher rejects missing, remote, and ordinary local targets", () => {
  const script = fileURLToPath(
    new URL("../scripts/test-ingestion-db.mjs", import.meta.url),
  );
  for (const target of [
    undefined,
    "not a URL",
    "postgresql://fixture:fixture@neon.invalid/vc_memory_idempotency_test",
    "postgresql://fixture:fixture@127.0.0.1/application",
  ]) {
    const env = { ...process.env };
    if (target) env.INGESTION_TEST_DATABASE_URL = target;
    else delete env.INGESTION_TEST_DATABASE_URL;
    const child = spawnSync(process.execPath, [script], {
      env,
      encoding: "utf8",
    });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /Set INGESTION_TEST_DATABASE_URL/);
  }
});
