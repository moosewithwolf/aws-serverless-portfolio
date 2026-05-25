export type ChatConfig = {
  enabled: boolean;
  message: string;
};

const offlineConfig: ChatConfig = {
  enabled: false,
  message: "Chat is currently offline.",
};

export async function loadChatConfig(): Promise<ChatConfig> {
  try {
    const response = await fetch(`/chat-config.json?ts=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return offlineConfig;
    }

    const payload = (await response.json()) as Partial<ChatConfig>;
    return {
      enabled: payload.enabled === true,
      message: typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : payload.enabled === true
          ? "Chat is online."
          : offlineConfig.message,
    };
  } catch {
    return offlineConfig;
  }
}
