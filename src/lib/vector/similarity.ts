/** Pure vector math for the local cosine-similarity store. */

function isFiniteVector(value: number[]): boolean {
  if (!value.length) return false;
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "number" || !Number.isFinite(value[i])) return false;
  }
  return true;
}

/** Invalid stored/provider vectors are non-matches, never NaN sort keys. */
export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length || !isFiniteVector(a) || !isFiniteVector(b)) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return Number.isFinite(s) ? s : 0;
}

export function magnitude(a: number[]): number {
  if (!isFiniteVector(a)) return 0;
  const scale = a.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  if (scale === 0) return 0;
  const norm = scale * Math.sqrt(a.reduce((sum, value) => sum + (value / scale) ** 2, 0));
  return Number.isFinite(norm) ? norm : 0;
}

/** Cosine similarity in [-1, 1]; ~1 means very similar. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !isFiniteVector(a) || !isFiniteVector(b)) return 0;
  const scaleA = a.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  const scaleB = b.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  if (scaleA === 0 || scaleB === 0) return 0;
  // Scaling each vector preserves its direction and avoids overflow/underflow.
  let product = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] / scaleA, y = b[i] / scaleB;
    product += x * y;
    normA += x * x;
    normB += y * y;
  }
  const score = product / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number.isFinite(score) ? Math.min(1, Math.max(-1, score)) : 0;
}
