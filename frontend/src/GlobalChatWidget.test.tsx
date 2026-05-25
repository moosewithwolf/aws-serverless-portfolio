import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";

import { GlobalChatWidget } from "./GlobalChatWidget";

describe("GlobalChatWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens and minimizes without unmounting the chat state", async () => {
    const user = userEvent.setup();

    render(<GlobalChatWidget chatConfig={{ enabled: true, message: "Chat is online." }} />);

    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    expect(screen.getByRole("heading", { name: "AI Chat" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Type a message..."), "Hello");
    expect(screen.getByDisplayValue("Hello")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Minimize AI chat" }));
    expect(screen.queryByRole("heading", { name: "AI Chat" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    expect(screen.getByDisplayValue("Hello")).toBeInTheDocument();
  });

  it("sends a message and renders the assistant response", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const target = String(url);

      if (target.endsWith("/chat") && init?.method === "POST") {
        return new Response(JSON.stringify({
          requestId: "chat_123",
          status: "PENDING",
        }));
      }

      if (target.includes("/chat/chat_123")) {
        return new Response(JSON.stringify({
          requestId: "chat_123",
          status: "DONE",
          message: "This portfolio uses AWS Lambda and SQS.",
          sanitized: true,
        }));
      }

      return new Response("not found", { status: 404 });
    });

    render(<GlobalChatWidget chatConfig={{ enabled: true, message: "Chat is online." }} />);

    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    await user.type(screen.getByPlaceholderText("Type a message..."), "Tell me about AWS");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/Me:/)).toBeInTheDocument();
    expect(await screen.findByText(/Tell me about AWS/)).toBeInTheDocument();
    expect(await screen.findByText(/AI:/)).toBeInTheDocument();
    expect(await screen.findByText(/Lambda and SQS/)).toBeInTheDocument();
  });
});
