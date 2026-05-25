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
});
