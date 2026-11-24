/**
 * Zod schemas for request validation and (optionally) constraining LLM output.
 * Centralizing them keeps the API routes thin and the error handling consistent.
 */

import { z } from "zod";
import { DECISIONS, DOC_TYPES } from "@/config/constants";
import { CHAT_LIMITS } from "@/lib/chat-context";
export { CHAT_LIMITS } from "@/lib/chat-context";

/** Validates a parsed-out structured extraction before it's written to the DB. */
export const extractedIntelligenceSchema = z.object({
  company: z.string().min(1),
  sector: z.string().optional(),
  stage: z.string().optional(),
  oneLiner: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  businessModel: z.string().optional(),
  market: z.string().optional(),
  traction: z.string().optional(),
  competition: z.string().optional(),
  founders: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        background: z.string().optional(),
      })
    )
    .optional(),
  strengths: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  concerns: z.array(z.string()).optional(),
  decision: z.enum(DECISIONS).nullable().optional(),
  decisionReason: z.string().nullable().optional(),
  docType: z.enum(DOC_TYPES).optional(),
});

/** Bounded, request-scoped context. Assistant history is never source evidence. */
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(CHAT_LIMITS.messageChars),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(CHAT_LIMITS.messageChars),
  }).strict()).max(CHAT_LIMITS.historyMessages).optional(),
  activeCompanyId: z.string().trim().min(1).max(128).optional(),
}).strict().superRefine((request, ctx) => {
  if ((request.history ?? []).reduce((sum, message) => sum + message.content.length, 0) > CHAT_LIMITS.historyChars) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["history"], message: "Recent context is too long." });
  }
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Investment brief request body. */
export const briefRequestSchema = z.object({
  companyId: z.string().min(1),
});

export type ExtractedIntelligenceInput = z.infer<
  typeof extractedIntelligenceSchema
>;
