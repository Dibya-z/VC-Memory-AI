/** Pure vector math for the local cosine-similarity store. */

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function magnitude(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Cosine similarity in [-1, 1]; ~1 means very similar. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const m = magnitude(a) * magnitude(b);
  return m === 0 ? 0 : dot(a, b) / m;
}
