export type ChatConfig = {
  enabled: boolean;
  message: string;
  modelName?: string;
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
    const modelName = typeof payload.modelName === "string" && payload.modelName.trim()
      ? payload.modelName.trim()
      : undefined;

    return {
      enabled: payload.enabled === true,
      message: typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : payload.enabled === true
          ? "Chat is online."
          : offlineConfig.message,
      ...(modelName ? { modelName } : {}),
    };
  } catch {
    return offlineConfig;
  }
}
