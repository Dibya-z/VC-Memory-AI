export const CHAT_LIMITS = {
  messageChars: 4000,
  historyMessages: 12,
  historyChars: 16000,
  bodyBytes: 100000,
} as const;

/** Keep the same small recent window in the browser that the API accepts. */
export function recentChatHistory(messages: {
  role: "user" | "assistant";
  content: string;
  excludeFromContext?: boolean;
}[]): { role: "user" | "assistant"; content: string }[] {
  const selected: { role: "user" | "assistant"; content: string }[] = [];
  let characters = 0;
  for (const message of messages.slice().reverse()) {
    if (message.excludeFromContext) continue;
    const content = message.content.trim().slice(0, CHAT_LIMITS.messageChars);
    if (!content) continue;
    if (selected.length >= CHAT_LIMITS.historyMessages || characters + content.length > CHAT_LIMITS.historyChars) break;
    selected.push({ role: message.role, content });
    characters += content.length;
  }
  return selected.reverse();
}
