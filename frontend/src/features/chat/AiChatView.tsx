import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { ChatConversation, useChatSession, type ChatMessage } from "./ChatConversation";
import type { ChatConfig } from "./chatConfig";
import { localModelName } from "../../shared/data/portfolioData";

type AiChatViewProps = {
  chatConfig: ChatConfig;
};

type StoredChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const CHAT_SESSIONS_STORAGE_KEY = "portfolio-ai-chat-sessions";
const ACTIVE_SESSION_STORAGE_KEY = "portfolio-ai-chat-active-session";
const emptySessionTitle = "New chat";
const samplePrompts = [
  "What projects should I look at first?",
  "Tell me about Shinseong's AWS work",
  "Summarize the backend experience",
];
const followUpPrompts = [
  "Which project shows AWS best?",
  "Show the tech stack highlights",
  "Summarize the resume highlights",
];

export function AiChatView({ chatConfig }: AiChatViewProps) {
  const [sessions, setSessions] = useState<StoredChatSession[]>(() => loadStoredSessions());
  const [activeSessionId, setActiveSessionId] = useState(() => readStorage(ACTIVE_SESSION_STORAGE_KEY) ?? undefined);
  const displayModelName = chatConfig.modelName ?? localModelName;

  const activeSession = useMemo(
    () => sessions.find((storedSession) => storedSession.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );

  const handleMessagesChange = useCallback(
    (messages: ChatMessage[]) => {
      if (!activeSession?.id) {
        return;
      }

      setSessions((currentSessions) => {
        const updatedSessions = currentSessions.map((storedSession) =>
          storedSession.id === activeSession.id
            ? {
                ...storedSession,
                messages,
                title: getSessionTitle(messages),
                updatedAt: Date.now(),
              }
            : storedSession,
        );

        writeStorage(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
        return updatedSessions;
      });
      writeStorage(ACTIVE_SESSION_STORAGE_KEY, activeSession.id);
    },
    [activeSession?.id],
  );

  const session = useChatSession(chatConfig, {
    initialMessages: activeSession?.messages ?? [],
    onMessagesChange: handleMessagesChange,
    resetKey: activeSession?.id,
  });

  const handleNewChat = () => {
    const emptySession = sessions.find((storedSession) => storedSession.messages.length === 0);

    if (emptySession) {
      setActiveSessionId(emptySession.id);
      writeStorage(ACTIVE_SESSION_STORAGE_KEY, emptySession.id);
      return;
    }

    const newSession = createStoredSession();
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setActiveSessionId(newSession.id);
    writeStorage(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    writeStorage(ACTIVE_SESSION_STORAGE_KEY, newSession.id);
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    writeStorage(ACTIVE_SESSION_STORAGE_KEY, sessionId);
  };

  const handleClearHistory = () => {
    const newSession = createStoredSession();
    const nextSessions = [newSession];
    setSessions(nextSessions);
    setActiveSessionId(newSession.id);
    writeStorage(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(nextSessions));
    writeStorage(ACTIVE_SESSION_STORAGE_KEY, newSession.id);
  };

  return (
    <section className="view active">
      <div className="ai-chat-page">
        <aside className="ai-chat-sidebar" aria-label="Chat history">
          <div className="ai-chat-sidebar-header">
            <span>Chats</span>
            <div className="ai-chat-sidebar-actions">
              <button type="button" onClick={handleNewChat}>
                New
              </button>
              <button aria-label="Clear chat history" type="button" onClick={handleClearHistory}>
                <Trash2 aria-hidden="true" size={14} strokeWidth={2.2} />
              </button>
            </div>
          </div>
          <div className="ai-chat-history-list">
            {sessions.map((storedSession) => (
              <button
                className={`ai-chat-history-item ${storedSession.id === activeSession?.id ? "active" : ""}`}
                key={storedSession.id}
                onClick={() => handleSelectSession(storedSession.id)}
                type="button"
              >
                {storedSession.title}
              </button>
            ))}
          </div>
        </aside>

        <div className="ai-chat-main" aria-label="Portfolio AI conversation">
          <div className="ai-chat-page-header">
            <div>
              <h2>Portfolio AI</h2>
              <p>Ask quick questions about the work, stack, resume, and project details.</p>
            </div>
            <div className="ai-chat-status-stack">
              <span className={`global-chat-status ${chatConfig.enabled ? "online" : "offline"}`}>
                {chatConfig.enabled ? "Online" : "Offline"}
              </span>
              <span className="ai-chat-model-name">{displayModelName}</span>
            </div>
          </div>
          <ChatConversation
            chatConfig={chatConfig}
            session={session}
            className="ai-chat-conversation"
            emptyContent={
              <div className="ai-chat-empty-state">
                <p>Start with a practical portfolio question.</p>
                <div className="ai-chat-sample-prompts">
                  {samplePrompts.map((prompt) => (
                    <button
                      disabled={session.loading || !chatConfig.enabled}
                      key={prompt}
                      onClick={() => {
                        void session.sendMessage(prompt);
                      }}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            }
            followUpPrompts={followUpPrompts}
            placeholder="Ask about projects, AWS, backend work..."
          />
        </div>
      </div>
    </section>
  );
}

function createStoredSession(): StoredChatSession {
  const now = Date.now();
  return {
    id: createSessionId(),
    title: emptySessionTitle,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadStoredSessions(): StoredChatSession[] {
  const storedValue = readStorage(CHAT_SESSIONS_STORAGE_KEY);

  if (!storedValue) {
    return [createStoredSession()];
  }

  try {
    const parsed = JSON.parse(storedValue) as StoredChatSession[];
    const validSessions = parsed.filter((session) => session.id && Array.isArray(session.messages));
    return validSessions.length > 0 ? validSessions : [createStoredSession()];
  } catch {
    return [createStoredSession()];
  }
}

function getSessionTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();

  if (!firstUserMessage) {
    return emptySessionTitle;
  }

  return firstUserMessage.length > 44 ? `${firstUserMessage.slice(0, 41)}...` : firstUserMessage;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Local history is optional; chat still works without browser storage.
  }
}
