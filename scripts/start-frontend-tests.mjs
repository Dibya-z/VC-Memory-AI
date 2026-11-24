/** Run Next in a disposable snapshot; never touch an active .next or real database. */
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = await mkdtemp(path.join(tmpdir(), "vc-memory-frontend-"));
const entries = [
  "src",
  "prisma",
  "public",
  "package.json",
  "tsconfig.json",
  "next-env.d.ts",
  "next.config.mjs",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "eslint.config.mjs",
];
await Promise.all(
  entries.map((entry) =>
    cp(path.join(root, entry), path.join(snapshot, entry), { recursive: true }),
  ),
);
await symlink(
  path.join(root, "node_modules"),
  path.join(snapshot, "node_modules"),
  "dir",
);
const child = spawn(
  process.execPath,
  [
    path.join(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "-p",
    "3101",
  ],
  {
    cwd: snapshot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(path.join(root, "tests/frontend/fixtures/database.cjs"))}`,
      DATABASE_URL: "postgresql://test:test@127.0.0.1:9/disabled",
      DIRECT_URL: "postgresql://test:test@127.0.0.1:9/disabled",
      GROQ_API_KEY: "",
      VOYAGE_API_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", async (code) => {
  await rm(snapshot, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});
