import { useState } from "react";

import { PollTimeoutError, pollChat, postChat, type ChatResponse } from "./chatApi";
import type { ChatConfig } from "./chatConfig";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function GlobalChatWidget({ chatConfig }: { chatConfig: ChatConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !chatConfig.enabled) {
      return;
    }

    setMessages((previous) => [...previous, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await postChat(trimmed);

      if (response.status === "DONE") {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: response.message ?? "Processing complete." },
        ]);
        return;
      }

      for await (const update of pollChat(response.requestId)) {
        if (update.status === "DONE") {
          setMessages((previous) => [
            ...previous,
            { role: "assistant", content: update.message || "Processing complete." },
          ]);
          break;
        }

        if (update.status === "ERROR") {
          setError(update.message || "Processing failed. Please try again.");
          break;
        }
      }
    } catch (err) {
      if (err instanceof PollTimeoutError) {
        setError("The local agent is offline or timed out. Please try again later.");
      } else {
        setError("Failed to send message. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

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
        <div>
          <h2>AI Chat</h2>
          <span className={`global-chat-status ${chatConfig.enabled ? "online" : "offline"}`}>
            {chatConfig.enabled ? "Online" : "Offline"}
          </span>
        </div>
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

        {messages.map((message, index) => (
          <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
            <strong>{message.role === "user" ? "Me: " : "AI: "}</strong>
            {message.content}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble assistant loading">
            <strong>AI: </strong>
            <span className="typing-indicator">Thinking...</span>
          </div>
        )}
      </div>

      {error && <div className="chat-error" role="alert">{error}</div>}

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={loading || !chatConfig.enabled}
          rows={2}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={loading || !input.trim() || !chatConfig.enabled}
          type="button"
        >
          Send
        </button>
      </div>
    </aside>
  );
}
