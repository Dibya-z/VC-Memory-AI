/**
 * Memory Chat page (Feature 2 — RAG over the firm's history).
 */

import { PageHeader } from "@/components/layout/PageHeader";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Chat"
        title="Memory chat"
        description="Ask the firm's history in plain language — answers grounded in your real past deals, with citations."
      />
      <ChatWindow />
    </div>
  );
}
