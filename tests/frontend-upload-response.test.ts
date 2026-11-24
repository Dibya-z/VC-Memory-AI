import assert from "node:assert/strict";
import test from "node:test";
import {
  isUploadIntelligence,
  isUploadResult,
  parseSingleUploadResponse,
} from "../src/lib/client/upload-response";

const intelligence = {
  company: "Fictional company",
  sector: "SaaS",
  stage: "Seed",
  oneLiner: "A product.",
  problem: "Problem",
  solution: "Solution",
  businessModel: "Subscription",
  market: "Market",
  traction: "Early",
  competition: "Others",
  founders: [{ name: "Founder", role: "CEO", background: "Experience" }],
  strengths: ["Signal"],
  risks: ["Risk"],
  concerns: [],
  decision: "Tracking",
  decisionReason: "Review later",
  docType: "pitch_deck",
};

test("upload response accepts the complete known extraction contract and optional nullable decisions", () => {
  assert.equal(isUploadIntelligence(intelligence), true);
  assert.equal(
    isUploadIntelligence({
      company: "Company",
      decision: null,
      decisionReason: null,
    }),
    true,
  );
  const result = {
    ok: true,
    filename: "deck.md",
    companyId: "company-id",
    documentId: "document-id",
    intelligence,
  };
  assert.deepEqual(parseSingleUploadResponse({ results: [result] }), result);
  assert.equal(isUploadResult({ ok: true, filename: "deck.md" }), true);
});

test("upload response rejects malformed envelopes and result identifiers/status", () => {
  for (const value of [
    null,
    [],
    {},
    { results: null },
    { results: [] },
    { results: [null] },
    { results: [{ ok: "true", filename: "deck.md" }] },
    { results: [{ ok: true, filename: {} }] },
    { results: [{ ok: true, filename: "deck.md", companyId: {} }] },
    { results: [{ ok: true, filename: "deck.md", documentId: 2 }] },
    { results: [{ ok: false, filename: "deck.md", error: {} }] },
    {
      results: [
        { ok: true, filename: "a" },
        { ok: true, filename: "b" },
      ],
    },
  ]) {
    assert.equal(parseSingleUploadResponse(value), null);
  }
});

test("object-valued company data cannot reach React rendering", () => {
  assert.equal(
    parseSingleUploadResponse({
      results: [
        { ok: true, filename: "deck.md", intelligence: { company: {} } },
      ],
    }),
    null,
  );
  assert.equal(isUploadIntelligence({ company: "" }), false);
  assert.equal(isUploadIntelligence([]), false);
});

test("every optional narrative field and list is validated before presentation", () => {
  for (const field of [
    "sector",
    "stage",
    "oneLiner",
    "problem",
    "solution",
    "businessModel",
    "market",
    "traction",
    "competition",
  ]) {
    assert.equal(isUploadIntelligence({ ...intelligence, [field]: {} }), false);
  }
  for (const field of ["strengths", "risks", "concerns"]) {
    assert.equal(
      isUploadIntelligence({ ...intelligence, [field]: ["Valid", {}] }),
      false,
    );
    assert.equal(isUploadIntelligence({ ...intelligence, [field]: {} }), false);
  }
  for (const founders of [
    {},
    [null],
    [{}],
    [{ name: {} }],
    [{ name: "Founder", role: {} }],
    [{ name: "Founder", background: [] }],
  ]) {
    assert.equal(isUploadIntelligence({ ...intelligence, founders }), false);
  }
  for (const extra of [
    { decision: "Unknown" },
    { decision: {} },
    { decisionReason: {} },
    { docType: "arbitrary" },
  ]) {
    assert.equal(isUploadIntelligence({ ...intelligence, ...extra }), false);
  }
});

test("failed upload without a server explanation gets a useful recoverable message", () => {
  const result = parseSingleUploadResponse({
    results: [{ ok: false, filename: "deck.md" }],
  });
  assert.equal(result?.ok, false);
  assert.match(result?.error ?? "", /Check Company Memory before retrying/);
});

test("pending/replayed uploads retain the durable server state and reject conflicting metadata", () => {
  const pending = {
    ok: false,
    filename: "deck.md",
    pending: true,
    retryAfterSeconds: 20,
    error: "This document is already processing.",
  };
  assert.deepEqual(parseSingleUploadResponse({ results: [pending] }), pending);
  assert.equal(
    isUploadResult({ ok: true, filename: "deck.md", reused: true }),
    true,
  );
  for (const metadata of [
    { pending: "yes" },
    { pending: true },
    { reused: {} },
    { retryAfterSeconds: -1 },
    { retryAfterSeconds: Infinity },
    { retryAfterSeconds: 0.5 },
    { retryAfterSeconds: 3601 },
  ]) {
    assert.equal(
      isUploadResult({ ok: true, filename: "deck.md", ...metadata }),
      false,
    );
  }
});
