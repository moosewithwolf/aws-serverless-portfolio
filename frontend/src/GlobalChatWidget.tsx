import { useState } from "react";

import type { ChatConfig } from "./chatConfig";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function GlobalChatWidget({ chatConfig }: { chatConfig: ChatConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  if (!isOpen) {
    return (
      <button
        aria-label="Open AI chat"
        className="chat-fab"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        AI
      </button>
    );
  }

  return (
    <aside className="global-chat-panel" aria-label="AI chat">
      <div className="global-chat-header">
        <h2>AI Chat</h2>
        <button
          aria-label="Minimize AI chat"
          type="button"
          onClick={() => setIsOpen(false)}
        >
          -
        </button>
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>
              {chatConfig.enabled
                ? "No messages yet. Send a message to start the conversation!"
                : chatConfig.message}
            </p>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message..."
          disabled={!chatConfig.enabled}
          rows={2}
        />
        <button
          className="chat-send-btn"
          disabled={!chatConfig.enabled || !input.trim()}
          type="button"
        >
          Send
        </button>
      </div>
    </aside>
  );
}
