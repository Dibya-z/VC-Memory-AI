/**
 * Embeddings facade. The rest of the app imports from here so the provider can
 * be swapped (Voyage today; OpenAI/Cohere/local later) without touching callers.
 */
export { embed, embedOne, type EmbedInputType } from "@/lib/embeddings/voyage";
