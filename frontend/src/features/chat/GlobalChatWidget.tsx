import { useState } from "react";

import { ChatConversation, useChatSession } from "./ChatConversation";
import type { ChatConfig } from "./chatConfig";

type GlobalChatWidgetProps = {
  chatConfig: ChatConfig;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function GlobalChatWidget({ chatConfig, isOpen, onOpenChange }: GlobalChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const session = useChatSession(chatConfig);
  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  if (!open) {
    return (
      <button
        aria-label="Open AI chat"
        className="chat-fab"
        type="button"
        onClick={() => setOpen(true)}
      >
        AI
      </button>
    );
  }

  return (
    <aside className="global-chat-panel" aria-label="Floating AI chat">
      <div className="global-chat-header">
        <div>
          <h2>AI Chat</h2>
          <span className={`global-chat-status ${chatConfig.enabled ? "online" : "offline"}`}>
            {chatConfig.enabled ? "Online" : "Offline"}
          </span>
        </div>
        <button
          aria-label="Minimize AI chat"
          type="button"
          onClick={() => setOpen(false)}
        >
          -
        </button>
      </div>

      <ChatConversation chatConfig={chatConfig} session={session} />
    </aside>
  );
}
