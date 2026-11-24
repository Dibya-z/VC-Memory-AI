import { DECISIONS, DOC_TYPES } from "@/config/constants";
import type { ExtractedIntelligence, UploadResult } from "@/lib/types";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

/** Mirror the extraction payload used by the presentation layer without a server import. */
export function isUploadIntelligence(
  value: unknown,
): value is ExtractedIntelligence {
  if (
    !record(value) ||
    typeof value.company !== "string" ||
    value.company.length === 0
  )
    return false;
  const textFields = [
    "sector",
    "stage",
    "oneLiner",
    "problem",
    "solution",
    "businessModel",
    "market",
    "traction",
    "competition",
  ];
  if (!textFields.every((field) => optionalString(value[field]))) return false;
  if (
    !["strengths", "risks", "concerns"].every(
      (field) =>
        value[field] === undefined ||
        (Array.isArray(value[field]) &&
          value[field].every((item: unknown) => typeof item === "string")),
    )
  )
    return false;
  if (
    value.founders !== undefined &&
    (!Array.isArray(value.founders) ||
      !value.founders.every(
        (founder: unknown) =>
          record(founder) &&
          typeof founder.name === "string" &&
          optionalString(founder.role) &&
          optionalString(founder.background),
      ))
  )
    return false;
  if (
    value.decision !== undefined &&
    value.decision !== null &&
    !(DECISIONS as readonly unknown[]).includes(value.decision)
  )
    return false;
  if (value.decisionReason !== null && !optionalString(value.decisionReason))
    return false;
  if (
    value.docType !== undefined &&
    !(DOC_TYPES as readonly unknown[]).includes(value.docType)
  )
    return false;
  return true;
}

export function isUploadResult(value: unknown): value is UploadResult {
  return (
    record(value) &&
    typeof value.ok === "boolean" &&
    typeof value.filename === "string" &&
    optionalString(value.error) &&
    optionalString(value.companyId) &&
    optionalString(value.documentId) &&
    (value.pending === undefined || typeof value.pending === "boolean") &&
    (value.reused === undefined || typeof value.reused === "boolean") &&
    !(value.pending === true && value.ok === true) &&
    (value.retryAfterSeconds === undefined ||
      (typeof value.retryAfterSeconds === "number" &&
        Number.isSafeInteger(value.retryAfterSeconds) &&
        value.retryAfterSeconds >= 1 &&
        value.retryAfterSeconds <= 3600)) &&
    (value.intelligence === undefined ||
      isUploadIntelligence(value.intelligence))
  );
}

/** Each queue request contains exactly one file and must return one well-formed result. */
export function parseSingleUploadResponse(value: unknown): UploadResult | null {
  if (
    !record(value) ||
    !Array.isArray(value.results) ||
    value.results.length !== 1 ||
    !isUploadResult(value.results[0])
  )
    return null;
  const result = value.results[0];
  return result.ok || result.error
    ? result
    : {
        ...result,
        error:
          "This document could not be processed. Check Company Memory before retrying.",
      };
}
