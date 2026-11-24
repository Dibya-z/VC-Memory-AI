import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const env = {
  NODE_ENV: "test" as const, PATH: process.env.PATH, DOTENV_CONFIG_PATH: "/dev/null",
  DATABASE_URL: "must-not-be-read-database-secret", DIRECT_URL: "must-not-be-read-direct-secret",
};
function command(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/evaluate-memory-provider.ts", ...args], {
    encoding: "utf8", env, timeout: 10000,
  });
}

test("provider smoke help is available without credentials, environment loading, or app imports", () => {
  const result = command(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /public fictional fixtures; no database/);
  assert.match(result.stdout, /--live/);
  assert.doesNotMatch(result.stdout + result.stderr, /must-not-be-read|Prisma|GROQ_API_KEY is required/);
});

test("provider smoke evaluation is refused by default before reading credentials", () => {
  const result = command([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires explicit --live/);
  assert.doesNotMatch(result.stdout + result.stderr, /must-not-be-read|Prisma|connect|P1001/);
});

test("provider smoke request bounds and output requirements precede credentials and app imports", () => {
  const good = ["--live", "--cases", "meeting", "--repeat", "1", "--pace-ms", "21000", "--out", "/tmp/unused-provider-smoke-report.json"];
  for (const extra of [
    ["--cases", "not-a-case"], ["--cases", "meeting,meeting"], ["--cases", "meeting,"],
    ["--repeat", "0"], ["--repeat", "4"], ["--repeat", "1.5"],
    ["--cases", "meeting,facts,followup,unknown", "--repeat", "3"],
    ["--pace-ms", "1"], ["--pace-ms", "60001"], ["--out", ""], ["--out", ".env"],
  ]) {
    const result = command([...good, ...extra]);
    assert.equal(result.status, 1, JSON.stringify(extra));
    assert.match(result.stderr, /Provide distinct --cases/);
    assert.doesNotMatch(result.stdout + result.stderr, /must-not-be-read|Prisma|connect|P1001|GROQ_API_KEY is required/);
  }
  const missingOutput = command(["--live", "--cases", "meeting"]);
  assert.equal(missingOutput.status, 1);
  assert.match(missingOutput.stderr, /new --out \.json path/);
});

test("valid provider-smoke arguments still require a configured key before any app import", () => {
  const result = command(["--live", "--cases", "meeting", "--out", "/tmp/unused-provider-smoke-no-key.json"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /GROQ_API_KEY is required/);
  assert.doesNotMatch(result.stdout + result.stderr, /must-not-be-read|Prisma|connect|P1001/);
});

test("unknown provider-smoke flags are sanitized before environment loading", () => {
  const result = command(["--private-secret-argument"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid provider-smoke arguments/);
  assert.doesNotMatch(result.stderr, /private-secret-argument|must-not-be-read/);
});
