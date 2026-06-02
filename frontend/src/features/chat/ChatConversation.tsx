import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { PollTimeoutError, pollChat, postChat, type ChatResponse } from "./chatApi";
import type { ChatConfig } from "./chatConfig";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatSession = {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  error: string | null;
  setInput: (value: string) => void;
  sendMessage: () => Promise<void>;
};

type ChatSessionOptions = {
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  resetKey?: string;
};

export function useChatSession(chatConfig: ChatConfig, options: ChatSessionOptions = {}): ChatSession {
  const { initialMessages = [], onMessagesChange, resetKey } = options;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      abortController.current?.abort();

      if (typingTimer.current !== null) {
        window.clearInterval(typingTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
    setInput("");
    setLoading(false);
    setError(null);
    abortController.current?.abort();
  }, [resetKey]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  const appendAssistantMessage = (content: string) => {
    return new Promise<void>((resolve) => {
      const messageIndex = messages.length + 1;
      let cursor = 0;

      setMessages((previous) => [...previous, { role: "assistant", content: "" }]);

      typingTimer.current = window.setInterval(() => {
        cursor += 2;
        const visible = content.slice(0, cursor);
        setMessages((previous) =>
          previous.map((message, index) =>
            index === messageIndex ? { ...message, content: visible } : message,
          ),
        );

        if (cursor >= content.length) {
          if (typingTimer.current !== null) {
            window.clearInterval(typingTimer.current);
            typingTimer.current = null;
          }
          resolve();
        }
      }, 14);
    });
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !chatConfig.enabled) {
      return;
    }

    setMessages((previous) => [...previous, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    try {
      const response: ChatResponse = await postChat(trimmed, controller.signal);

      if (response.status === "DONE") {
        await appendAssistantMessage(response.message ?? "Processing complete.");
        return;
      }

      for await (const update of pollChat(response.requestId, controller.signal)) {
        if (update.status === "DONE") {
          await appendAssistantMessage(update.message || "Processing complete.");
          break;
        }

        if (update.status === "ERROR") {
          setError(update.message || "Processing failed. Please try again.");
          break;
        }
      }
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) {
        return;
      }

      if (err instanceof PollTimeoutError) {
        setError("The local agent is offline or timed out. Please try again later.");
      } else {
        setError("Failed to send message. Please try again.");
      }
    } finally {
      if (abortController.current === controller) {
        abortController.current = null;
      }

      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  return { messages, input, loading, error, setInput, sendMessage };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type ChatConversationProps = {
  chatConfig: ChatConfig;
  session: ChatSession;
  className?: string;
  emptyContent?: ReactNode;
  emptyOnlineMessage?: string;
  modelLabel?: string;
  modelStatus?: "online" | "offline";
  placeholder?: string;
};

export function ChatConversation({
  chatConfig,
  session,
  className = "",
  emptyContent,
  emptyOnlineMessage = "No messages yet. Send a message to start the conversation!",
  modelLabel,
  modelStatus = "online",
  placeholder = "Type a message...",
}: ChatConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [session.messages, session.loading, session.error]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      session.sendMessage();
    }
  };

  return (
    <div className={className}>
      {modelLabel && (
        <div className={`chat-model-strip ${modelStatus}`}>
          <span>{modelLabel}</span>
        </div>
      )}

      <div className="chat-messages" aria-live="polite">
        {session.messages.length === 0 && (
          <div className="chat-empty">
            {chatConfig.enabled ? emptyContent ?? <p>{emptyOnlineMessage}</p> : <p>{chatConfig.message}</p>}
          </div>
        )}

        {session.messages.map((message, index) => (
          <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
            <strong>{message.role === "user" ? "Me: " : "AI: "}</strong>
            {message.content}
          </div>
        ))}

        {session.loading && session.messages.at(-1)?.role !== "assistant" && (
          <div className="chat-bubble assistant loading">
            <strong>AI: </strong>
            <span className="typing-indicator">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {session.error && <div className="chat-error" role="alert">{session.error}</div>}

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={session.input}
          onChange={(event) => session.setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={session.loading || !chatConfig.enabled}
          rows={2}
        />
        <button
          className="chat-send-btn"
          onClick={session.sendMessage}
          disabled={session.loading || !session.input.trim() || !chatConfig.enabled}
          type="button"
        >
          Send
        </button>
      </div>
    </div>
  );
}
