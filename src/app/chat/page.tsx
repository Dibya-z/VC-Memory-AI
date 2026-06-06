/**
 * Memory Chat page (Feature 2).
 * Conversational interface over the firm's memory. Example queries:
 *   "Show me all AI startups we rejected because of GTM concerns."
 *   "Prepare me for my meeting with FlowAI founder tomorrow."
 * Posts to /api/chat (RAG: embed -> retrieve -> Claude) and renders answers
 * with citations back to the source companies.
 *
 * TODO(impl): render <ChatWindow /> (message list + composer + citations).
 */
export default function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Memory chat</h1>
        <p className="text-sm text-muted-foreground">
          Ask your firm&apos;s memory anything. Grounded in your real past deals.
        </p>
      </div>
      {/* TODO: <ChatWindow /> */}
    </div>
  );
}
