/** Explicit opt-in: never infer a destructive test target from application .env. */
import { spawn } from "node:child_process";
const raw = process.env.INGESTION_TEST_DATABASE_URL;
let target;
try {
  target = raw ? new URL(raw) : null;
} catch {
  target = null;
}
if (
  !target ||
  target.protocol !== "postgresql:" ||
  target.hostname !== "127.0.0.1" ||
  target.pathname !== "/vc_memory_idempotency_test"
) {
  console.error(
    "Set INGESTION_TEST_DATABASE_URL to a disposable PostgreSQL database named vc_memory_idempotency_test on 127.0.0.1. Application DATABASE_URL is never used for these tests.",
  );
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "tests/ingestion-idempotency.test.ts",
    "tests/ingestion-database.integration.test.ts",
  ],
  { stdio: "inherit", env: process.env },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
