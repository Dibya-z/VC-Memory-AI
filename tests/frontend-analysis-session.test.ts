import assert from "node:assert/strict";
import test from "node:test";
import { UPLOAD } from "../src/config/constants";
import { documentFileKey, validateDocumentFile } from "../src/lib/client/files";
import {
  ANALYSIS_SESSION_LIMIT,
  parseAnalysisSession,
  type AnalysisSession,
} from "../src/lib/client/analysis-session";

const saved: AnalysisSession = {
  version: 1,
  mode: "text",
  text: "A retained, fictional deck input.",
  filename: "",
  analyzedName: "Pasted deck",
  analysis: {
    summary: "Summary",
    recommendation: "Needs review",
    positiveSignals: [],
    risks: ["Risk"],
    founderQuestions: [],
    similarCompanies: [],
  },
};

test("both document workflows accept supported case variants and the exact size limit", () => {
  assert.equal(
    validateDocumentFile({ name: "DECK.PDF", size: UPLOAD.MAX_SIZE_BYTES }),
    null,
  );
  assert.equal(validateDocumentFile({ name: "notes.md", size: 1 }), null);
  assert.match(
    validateDocumentFile({ name: "empty.txt", size: 0 }) ?? "",
    /empty/i,
  );
  assert.match(
    validateDocumentFile({
      name: "large.pdf",
      size: UPLOAD.MAX_SIZE_BYTES + 1,
    }) ?? "",
    /too large/i,
  );
  assert.match(
    validateDocumentFile({ name: "deck.exe", size: 10 }) ?? "",
    /unsupported/i,
  );
});

test("selection identity distinguishes different file versions without conflating separator characters", () => {
  const file = { name: "deck:one.md", size: 123, lastModified: 456 };
  assert.equal(documentFileKey(file), documentFileKey({ ...file }));
  assert.notEqual(
    documentFileKey(file),
    documentFileKey({ ...file, lastModified: 457 }),
  );
  assert.notEqual(
    documentFileKey(file),
    documentFileKey({ ...file, name: "deck", size: 1 }),
  );
});

test("valid optional analysis storage restores source and result without requiring a File object", () => {
  assert.deepEqual(parseAnalysisSession(JSON.stringify(saved)), saved);
  const fileSource = {
    ...saved,
    mode: "file",
    filename: "original.pdf",
    analysis: null,
  };
  assert.deepEqual(
    parseAnalysisSession(JSON.stringify(fileSource)),
    fileSource,
  );
});

test("analysis restoration rejects corrupt, unsupported and oversized storage", () => {
  for (const serialized of [
    "{",
    "null",
    "[]",
    JSON.stringify({ ...saved, version: 2 }),
    " ".repeat(ANALYSIS_SESSION_LIMIT + 1),
  ]) {
    assert.equal(parseAnalysisSession(serialized), null);
  }
  assert.equal(
    parseAnalysisSession(
      JSON.stringify({ ...saved, text: "a".repeat(120_001) }),
    ),
    null,
  );
  assert.equal(
    parseAnalysisSession(
      JSON.stringify({ ...saved, filename: "a".repeat(1_001) }),
    ),
    null,
  );
});

test("analysis restoration rejects malformed report arrays and comparable records", () => {
  assert.equal(
    parseAnalysisSession(
      JSON.stringify({
        ...saved,
        analysis: { ...saved.analysis, risks: [null] },
      }),
    ),
    null,
  );
  assert.equal(
    parseAnalysisSession(
      JSON.stringify({
        ...saved,
        analysis: {
          ...saved.analysis,
          positiveSignals: Array(101).fill("signal"),
        },
      }),
    ),
    null,
  );
  assert.equal(
    parseAnalysisSession(
      JSON.stringify({
        ...saved,
        analysis: {
          ...saved.analysis,
          similarCompanies: [
            { companyId: "id", name: "Company", similarity: null },
          ],
        },
      }),
    ),
    null,
  );
  assert.equal(
    parseAnalysisSession(
      JSON.stringify({
        ...saved,
        analysis: {
          ...saved.analysis,
          similarCompanies: [
            { companyId: "id", name: "Company", similarity: 0.8, reason: {} },
          ],
        },
      }),
    ),
    null,
  );
});
