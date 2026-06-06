/**
 * Voyage AI embeddings client. Plain REST call, no SDK needed.
 *
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 * Default model `voyage-3.5` returns 1024-dim vectors — a strong general-purpose
 * choice for retrieval. `input_type` distinguishes stored documents from queries
 * for better asymmetric retrieval.
 *
 * Rate limits: Voyage's free tier WITHOUT a payment method is capped at ~3
 * requests/min (the 200M free tokens/month still apply). Bulk ingestion will
 * transiently hit HTTP 429, so we retry with backoff (honoring Retry-After)
 * rather than fail. Tune via VOYAGE_MAX_RETRIES. Once a card is added (still
 * $0 under the free tokens), the limit lifts and retries effectively never fire.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5";
const MAX_RETRIES = Number(process.env.VOYAGE_MAX_RETRIES ?? 6);

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

  for (let attempt = 0; ; attempt++) {
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

    if (res.ok) {
      const json = (await res.json()) as {
        data: { embedding: number[]; index: number }[];
      };
      // Preserve input order.
      return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }

    // 429 (rate limit) and 5xx (transient server) are worth retrying.
    const retryable = res.status === 429 || res.status >= 500;
    const body = await res.text();
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`Voyage embeddings failed (${res.status}): ${body}`);
    }

    const waitMs = retryDelayMs(res, attempt);
    console.warn(
      `Voyage ${res.status} — waiting ${Math.round(waitMs / 1000)}s then retrying ` +
        `(attempt ${attempt + 1}/${MAX_RETRIES}). Free-tier rate limit; this is expected.`
    );
    await sleep(waitMs);
  }
}

/** Convenience for a single string. */
export async function embedOne(
  text: string,
  inputType: EmbedInputType = "query"
): Promise<number[]> {
  const [vec] = await embed([text], inputType);
  return vec;
}

/** How long to wait before the next retry. Honors Retry-After when present. */
function retryDelayMs(res: Response, attempt: number): number {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (!Number.isNaN(secs) && secs > 0) return secs * 1000 + 500;
  }
  // No header: free tier is ~3 req/min, so wait ~22s for 429 (creeping up on
  // repeats); quick exponential backoff for transient 5xx.
  if (res.status === 429) return 22000 + attempt * 3000;
  return Math.min(1000 * 2 ** attempt, 15000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
