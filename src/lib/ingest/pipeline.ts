/** Durable upload orchestration: claim once, do external work, then commit atomically. */
import { createHash, randomUUID } from "node:crypto";
import { extractText, fileTypeOf, type ExtractedText } from "./extract-text";
import { chunkText } from "./chunk";
import { extractIntelligence } from "@/lib/ai/extract";
import { embed } from "@/lib/embeddings";
import { createPrismaIngestionRepository } from "@/lib/db/ingestion";
import { extractedIntelligenceSchema } from "@/lib/validators";
import type { ExtractedIntelligence } from "@/lib/types";
import {
  IngestionLeaseLostError,
  UploadInProgressError,
  type IngestionRepository,
  type IngestionResult,
} from "./contract";

export { IngestionLeaseLostError, UploadInProgressError } from "./contract";
export type IngestResult = IngestionResult;
export interface IngestInput {
  buffer: Buffer;
  filename: string;
  mime: string;
  /** Historical observation time for isolated demo ingestion; not part of identity. */
  metAt?: Date;
}
interface IngestionDependencies {
  repository: IngestionRepository;
  extractText: (input: IngestInput) => Promise<ExtractedText>;
  extractIntelligence: (text: string) => Promise<ExtractedIntelligence>;
  embed: (texts: string[], type: "document") => Promise<number[][]>;
  /** Bounds provider/parsing work; final database commit has its own short timeout. */
  workTimeoutMs?: number;
}
export class IngestionFailedError extends Error {
  constructor(
    message = "Could not process this document. Retry this upload to reuse its existing document record.",
  ) {
    super(message);
    this.name = "IngestionFailedError";
  }
}

/** Stable across filenames, request IDs, refreshes and server instances. */
export function uploadContentKey(
  buffer: Buffer,
  fileType: ExtractedText["fileType"],
): string {
  // Bump the explicit namespace only for an intentional reprocessing migration.
  return `upload-v1:${fileType}:${createHash("sha256").update(buffer).digest("hex")}`;
}

export function createIngestor(dependencies: IngestionDependencies) {
  return async function ingest(input: IngestInput): Promise<IngestionResult> {
    const fileType = fileTypeOf(input.filename);
    const key = uploadContentKey(input.buffer, fileType);
    const acquired = await dependencies.repository.claim({
      key,
      ownerToken: randomUUID(),
      filename: input.filename,
      fileType,
      sizeBytes: input.buffer.byteLength,
      metAt: input.metAt ?? new Date(),
    });
    if (acquired.kind === "complete") return acquired.result;
    if (acquired.kind === "busy")
      throw new UploadInProgressError(acquired.retryAfterSeconds);
    const { claim } = acquired;
    let stage: "parsing" | "providers" = "parsing";
    const deadline = Date.now() + (dependencies.workTimeoutMs ?? 45_000);
    async function step<T>(operation: () => Promise<T>): Promise<T> {
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new IngestionFailedError(
          "Processing took too long. Retry this upload to resume using the same document record.",
        );
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          operation(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new IngestionFailedError(
                    "Processing took too long. Retry this upload to resume using the same document record.",
                  ),
                ),
              remaining,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    async function renew() {
      if (!(await dependencies.repository.renew(claim)))
        throw new IngestionLeaseLostError();
    }
    try {
      const extracted = await step(() => dependencies.extractText(input));
      if (extracted.fileType !== fileType || !extracted.text.trim())
        throw new IngestionFailedError(
          "This document could not be read. Use a text-based PDF, .txt, or .md document.",
        );
      await renew();
      stage = "providers";
      const intelligence = extractedIntelligenceSchema.parse(
        await step(() => dependencies.extractIntelligence(extracted.text)),
      );
      intelligence.company = intelligence.company.trim();
      if (!intelligence.company) throw new IngestionFailedError();
      await renew();
      const chunks = chunkText(extracted.text);
      const vectors: number[][] = [];
      let dimensions: number | undefined;
      for (let offset = 0; offset < chunks.length; offset += 96) {
        const batch = chunks.slice(offset, offset + 96);
        const batchVectors = await step(() =>
          dependencies.embed(batch, "document"),
        );
        dimensions ??= batchVectors[0]?.length;
        if (
          batchVectors.length !== batch.length ||
          batchVectors.some(
            (vector) =>
              !Array.isArray(vector) ||
              !vector.length ||
              vector.length !== dimensions ||
              !vector.every(Number.isFinite) ||
              !vector.some((value) => value !== 0),
          )
        )
          throw new IngestionFailedError(
            "The search index could not be completed. Retry this upload to reuse its document record.",
          );
        vectors.push(...batchVectors);
        await renew();
      }
      return await dependencies.repository.complete(claim, {
        text: extracted.text,
        intelligence,
        chunks: chunks.map((content, ordinal) => ({
          content,
          ordinal,
          embedding: vectors[ordinal],
        })),
      });
    } catch (error) {
      // This conditional write is fenced too: an old worker cannot fail a retry.
      // Preserve the original safe error even if the database becomes unavailable.
      await dependencies.repository.fail(claim).catch(() => {});
      if (
        error instanceof UploadInProgressError ||
        error instanceof IngestionFailedError
      )
        throw error;
      throw new IngestionFailedError(
        stage === "parsing"
          ? "This document could not be read. Use a text-based PDF, .txt, or .md document."
          : undefined,
      );
    }
  };
}

export const ingestDocument = createIngestor({
  repository: createPrismaIngestionRepository(),
  extractText,
  extractIntelligence,
  embed,
});
