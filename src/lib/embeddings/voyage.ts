/**
 * Voyage AI embeddings client (Anthropic's recommended embeddings partner —
 * Anthropic has no first-party embeddings API). Plain REST call, no SDK needed.
 *
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 * Default model `voyage-3.5` returns 1024-dim vectors — a strong general-purpose
 * choice for retrieval. `input_type` distinguishes stored documents from queries
 * for better asymmetric retrieval.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5";

export type EmbedInputType = "document" | "query";

export async function embed(
  texts: string[],
  inputType: EmbedInputType = "document"
): Promise<number[][]> {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error(
      "VOYAGE_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
  if (texts.length === 0) return [];

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage embeddings failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  // Preserve input order.
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Convenience for a single string. */
export async function embedOne(
  text: string,
  inputType: EmbedInputType = "query"
): Promise<number[]> {
  const [vec] = await embed([text], inputType);
  return vec;
}
