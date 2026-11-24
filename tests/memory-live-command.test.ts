import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { databaseFingerprint } from "../scripts/lib/memory-live-safety";
import { fixtureCorpusFingerprint } from "./fixtures/memory";

const url = "postgresql://fixture-user:fixture-password@127.0.0.1:1/isolated_fixture";
const fingerprint = databaseFingerprint(url);
const env = {
  NODE_ENV: "test" as const,
  DOTENV_CONFIG_PATH: "/dev/null",
  PATH: process.env.PATH, MEMORY_CHAT_ENV: "development", MEMORY_CHAT_ISOLATED_DATABASE: "true",
  MEMORY_CHAT_TARGET_LABEL: "isolated-fixture-dev", MEMORY_CHAT_DATABASE_FINGERPRINT: fingerprint,
  DATABASE_URL: url, DIRECT_URL: url,
};
function command(args: string[], settings = env) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/evaluate-memory-live.ts", ...args], {
    encoding: "utf8", env: settings, timeout: 10000,
  });
}
const targetArgs = ["--target", env.MEMORY_CHAT_TARGET_LABEL, "--database-fingerprint", fingerprint];

test("live command inspects only an offline target fingerprint", () => {
  const result = command(["--inspect-target"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { databaseFingerprint: fingerprint, databaseAccessed: false });
  assert.ok(!result.stdout.includes("fixture-password"));
});

test("live command refuses mismatched explicit identity before any connection", () => {
  const result = command(["--target", "different-development", "--database-fingerprint", fingerprint]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Explicit --target/);
  assert.doesNotMatch(result.stderr, /fixture-password|127\.0\.0\.1|connect|P1001/);
});

test("live command rejects request and pacing bounds before any connection", () => {
  const good = [...targetArgs, "--cases", "exact_metrics", "--corpus-fingerprint", fixtureCorpusFingerprint, "--out", "/tmp/unused-memory-live-report.json"];
  for (const extra of [["--repeat", "3"], ["--pace-ms", "1"], ["--cases", "not-a-case"], ["--cases", "exact_metrics,exact_metrics"], ["--corpus-fingerprint", "unacknowledged-corpus"]]) {
    const result = command([...good, ...extra]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Provide 1–5/);
    assert.doesNotMatch(result.stderr, /fixture-password|127\.0\.0\.1|P1001/);
  }
});
