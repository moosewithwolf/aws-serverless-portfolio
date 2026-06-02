import { ChatConversation, useChatSession } from "./ChatConversation";
import type { ChatConfig } from "./chatConfig";
import { localModelName } from "../../shared/data/portfolioData";

type AiChatViewProps = {
  chatConfig: ChatConfig;
};

export function AiChatView({ chatConfig }: AiChatViewProps) {
  const session = useChatSession(chatConfig);

  return (
    <section className="view active">
      <div className="ai-chat-page">
        <div className="ai-chat-page-header">
          <h2>AI Chat</h2>
          <span className={`global-chat-status ${chatConfig.enabled ? "online" : "offline"}`}>
            {chatConfig.enabled ? "Online" : "Offline"}
          </span>
        </div>
        <ChatConversation
          chatConfig={chatConfig}
          session={session}
          className="ai-chat-conversation"
          emptyOnlineMessage="Ask about Shinseong's projects, skills, or AWS work."
          modelLabel={
            chatConfig.enabled
              ? `${localModelName} is answering from the local Docker model server.`
              : `${localModelName} will answer when the local agent is online.`
          }
          modelStatus={chatConfig.enabled ? "online" : "offline"}
        />
      </div>
    </section>
  );
}
