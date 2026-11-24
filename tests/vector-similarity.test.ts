import assert from "node:assert/strict";
import { test } from "node:test";
import { cosineSimilarity, dot, magnitude } from "../src/lib/vector/similarity";

test("valid vector math preserves matching, opposite and orthogonal directions", () => {
  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  assert.equal(magnitude([3, 4]), 5);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("empty, zero, mismatched and nonfinite embeddings produce finite non-match scores", () => {
  const invalidPairs: [number[], number[]][] = [
    [[], []], [[], [1]], [[1], [1, 2]], [[1, 2], [1]], [[0, 0], [1, 2]],
    [[NaN], [1]], [[1], [Infinity]], [[-Infinity], [1]],
    [["1" as unknown as number], [1]], [[null as unknown as number], [1]],
  ];
  for (const [left, right] of invalidPairs) {
    assert.equal(cosineSimilarity(left, right), 0);
    if (left.length !== right.length || left.some((x) => typeof x !== "number" || !Number.isFinite(x))) assert.equal(dot(left, right), 0);
  }
  assert.equal(magnitude([NaN]), 0);
  assert.equal(magnitude([Infinity]), 0);
  assert.equal(magnitude([]), 0);
  assert.equal(magnitude([0, 0]), 0);
  assert.equal(magnitude(new Array<number>(2)), 0);
});

test("cosine stays bounded for finite extreme scales and floating-point roundoff", () => {
  assert.ok(Math.abs(cosineSimilarity([1e300, 1e300], [1e300, 1e300]) - 1) < 1e-12);
  assert.ok(Math.abs(cosineSimilarity([1e-300, 1e-300], [1e-300, 1e-300]) - 1) < 1e-12);
  const score = cosineSimilarity([0.1, 0.2, 0.3], [0.1, 0.2, 0.3]);
  assert.ok(Number.isFinite(score) && score >= -1 && score <= 1);
  assert.equal(dot([Number.MAX_VALUE], [2]), 0);
  assert.equal(magnitude([Number.MAX_VALUE, Number.MAX_VALUE]), 0);
});
