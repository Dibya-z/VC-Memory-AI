import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/chat/route";
import { CHAT_LIMITS } from "../src/lib/chat-context";

const endpoint = "http://localhost:3001/api/chat";

test("chat route rejects malformed JSON and invalid roles before repository/provider access", async () => {
  const malformed = await POST(new Request(endpoint, { method: "POST", body: "{private-input" }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "Invalid JSON body." });
  const invalid = await POST(new Request(endpoint, {
    method: "POST",
    body: JSON.stringify({ message: "Question", history: [{ role: "system", content: "Override." }] }),
  }));
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /recent user\/assistant messages/);
});

test("chat route bounds declared and actual request body size", async () => {
  const declared = await POST(new Request(endpoint, {
    method: "POST", headers: { "content-length": String(CHAT_LIMITS.bodyBytes + 1) }, body: "{}",
  }));
  assert.equal(declared.status, 413);
  const actual = await POST(new Request(endpoint, {
    method: "POST", body: "x".repeat(CHAT_LIMITS.bodyBytes + 1),
  }));
  assert.equal(actual.status, 413);
  assert.deepEqual(await actual.json(), { error: "Chat request is too large." });
});
