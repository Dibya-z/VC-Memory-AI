import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMemoryPassages, MEMORY_PASSAGE_CHARS } from "../src/lib/ai/memory-passages";
import type { MemoryEvidence } from "../src/lib/ai/memory-contract";

function source(id: string, text: string, start = 40): MemoryEvidence {
  return { id, text, start, end: start + text.length, kind: "document", companyId: "alpha",
    companyName: "Alpha", documentId: id, documentName: "alpha.txt", documentType: "notes",
    chunkId: null, sourceDate: "October 2025", uploadedAt: null };
}

test("passages reconstruct original whitespace and source offsets without changing source content", () => {
  const evidence = [source("first", "  Founders: Ada and Ben.\r\n\r\nRevenue: $9k MRR.  \n"),
    source("second", "Market context\n\n" + "A detailed retained paragraph with unicode — café and $9k MRR. ".repeat(70), 90)];
  const passages = buildMemoryPassages(evidence);
  for (const item of evidence) {
    const own = passages.filter((passage) => passage.evidenceId === item.id);
    assert.equal(own.map((passage) => passage.text).join(""), item.text);
    let cursor = item.start;
    for (const passage of own) {
      assert.equal(passage.start, cursor);
      assert.equal(item.text.slice(passage.start - item.start, passage.end - item.start), passage.text);
      assert.ok(passage.text.length > 0 && passage.text.length <= MEMORY_PASSAGE_CHARS);
      cursor = passage.end;
    }
    assert.equal(cursor, item.end);
  }
  assert.deepEqual(buildMemoryPassages(evidence), passages);
  assert.deepEqual(passages.map((passage) => passage.id), passages.map((_, index) => `P${index + 1}`));
});

test("long words and Unicode remain exact bounded spans", () => {
  const evidence = [source("long", "a".repeat(2001)), source("unicode", "a" + "😀".repeat(901))];
  const passages = buildMemoryPassages(evidence);
  for (const item of evidence) {
    const own = passages.filter((passage) => passage.evidenceId === item.id);
    assert.equal(own.map((passage) => passage.text).join(""), item.text);
    for (const passage of own) {
      assert.ok(passage.text.length <= MEMORY_PASSAGE_CHARS);
      assert.ok(!/[\uD800-\uDBFF]$/.test(passage.text));
      assert.ok(!/^[\uDC00-\uDFFF]/.test(passage.text));
    }
  }
});

test("blank evidence creates no support passages", () => {
  assert.deepEqual(buildMemoryPassages([source("empty", ""), source("blank", "  \n\t")] ), []);
});
