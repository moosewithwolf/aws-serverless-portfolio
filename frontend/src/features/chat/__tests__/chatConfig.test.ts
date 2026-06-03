import { afterEach, describe, expect, it, vi } from "vitest";

import { loadChatConfig } from "../chatConfig";

describe("loadChatConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads enabled state from /chat-config.json", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ enabled: true, message: "Online", modelName: "Llama 3.2" })),
    );

    await expect(loadChatConfig()).resolves.toEqual({
      enabled: true,
      message: "Online",
      modelName: "Llama 3.2",
    });
  });

  it("fails closed when config cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("missing", { status: 404 }),
    );

    await expect(loadChatConfig()).resolves.toEqual({
      enabled: false,
      message: "Chat is currently offline.",
    });
  });

  it("ignores an empty model name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ enabled: true, message: "Online", modelName: " " })),
    );

    await expect(loadChatConfig()).resolves.toEqual({
      enabled: true,
      message: "Online",
    });
  });
});
