"use client";

/**
 * Memory chat surface (Feature 2): scrollable message list, composer, and
 * citation cards under assistant answers. Talks to /api/chat.
 *
 * TODO(impl): message state, send handler, loading state, citation rendering.
 * Sibling components to add: MessageBubble, CitationCard.
 */
export function ChatWindow() {
  return (
    <div className="flex flex-1 flex-col rounded-lg border bg-card">
      {/* TODO: messages + composer */}
    </div>
  );
}
