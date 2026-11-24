import test from "node:test";
import assert from "node:assert/strict";
import { requestJson } from "../src/lib/client/request";

test("client request returns JSON and preserves server recovery messages", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ value: 7 })),
  );
  assert.deepEqual(await requestJson("/api/test"), { value: 7 });
  fetch.mock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ error: "Please retry the task." }), {
        status: 503,
      }),
  );
  await assert.rejects(requestJson("/api/test"), /Please retry the task/);
});

test("unreadable responses give a useful error rather than exposing parser output", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>upstream error</html>", { status: 502 }),
  );
  await assert.rejects(requestJson("/api/test"), /unreadable response/);
});

test("client deadlines abort stalled requests", async (t) => {
  let aborted = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  );
  await assert.rejects(requestJson("/api/test", { timeoutMs: 5 }), {
    name: "TimeoutError",
  });
  assert.equal(aborted, true);
});

test("caller cancellation reaches the transport and has a distinct error", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  const controller = new AbortController();
  const pending = requestJson("/api/test", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
