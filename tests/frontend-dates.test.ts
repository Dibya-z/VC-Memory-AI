import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { timeAgo } from "../src/lib/utils";
import { DateTime } from "../src/components/ui/DateTime";

test("relative dates distinguish future, past, and unavailable timestamps", () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse("2026-11-25T12:00:00Z");
  try {
    assert.equal(timeAgo("2026-11-25T10:00:00Z"), "2 hours ago");
    assert.equal(timeAgo("2026-11-25T14:00:00Z"), "in 2 hours");
    assert.equal(timeAgo("2026-11-25T12:00:10Z"), "in a moment");
    assert.equal(timeAgo("invalid"), "Date unavailable");
  } finally {
    Date.now = originalNow;
  }
});

test("document dates expose a labeled machine-readable value and exact UTC detail", () => {
  const html = renderToStaticMarkup(
    createElement(DateTime, {
      value: "2026-11-25T12:34:00Z",
      label: "Uploaded",
    }),
  );
  assert.match(html, /dateTime="2026-11-25T12:34:00\.000Z"/);
  assert.match(html, /Uploaded: /);
  assert.match(html, /12:34 UTC/);
  assert.doesNotThrow(() =>
    renderToStaticMarkup(createElement(DateTime, { value: "bad-date" })),
  );
});
