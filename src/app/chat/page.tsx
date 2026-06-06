/**
 * Memory Chat page (Feature 2 — RAG over the firm's history). Not yet wired —
 * editorial header + placeholder for now.
 */

import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <PageHeader
        eyebrow="Institutional Memory · Chat"
        title="Memory chat"
        description="Ask the firm's history in plain language — answers grounded in your real past deals, with citations."
      />
      <Placeholder
        icon={MessageSquare}
        title="Memory chat is coming next"
        note="Once the retrieval layer is wired, you'll be able to ask questions like “Which AI startups did we pass on, and why?” and get cited answers."
      />
    </div>
  );
}
