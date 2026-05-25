import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const profile = {
  name: "Shinseong Kim",
  headline: "Full-Stack Developer & Cloud Architect",
  summary: "AWS-focused portfolio profile.",
  email: "skim570@myseneca.ca",
  projects: [
    {
      name: "NoraHangul",
      tag: "Spring Boot / React / AWS",
      description: "Student management system.",
    },
    {
      name: "Cloud Native Backend",
      tag: "AWS Lambda / SAM",
      description: "Serverless portfolio backend.",
    },
  ],
  skills: ["Python", "TypeScript", "React", "AWS"],
  certifications: ["AWS Solutions Architect Associate", "AWS Developer Associate"],
  education: {
    program: "Computer Programming and Analysis",
    school: "Seneca Polytechnic",
    location: "Toronto, ON",
    status: "2024 - Present",
  },
  aiRoadmap: {
    runtime: "llama.cpp",
    status: "planned-v2",
    description: "Local AI chatbot roadmap.",
  },
};

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/chat-config.json")) {
          return new Response(JSON.stringify({ enabled: true }));
        }
        if (url.endsWith("/health")) {
          return new Response(JSON.stringify({ status: "ok", service: "portfolio-api" }));
        }
        if (url.endsWith("/profile")) {
          return new Response(JSON.stringify(profile));
        }
        return new Response("Not found", { status: 404 });
      }),
    );
  });

  it("renders the portfolio shell and loads profile data from the API", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Shinseong Kim." })).toBeInTheDocument();
    expect(await screen.findByText("AWS Solutions Architect Associate")).toBeInTheDocument();
    expect(screen.getByText("API connected")).toBeInTheDocument();
  });

  it("switches between Projects, Resume, and AI Roadmap tabs", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Projects" }));
    expect(await screen.findByText("NoraHangul")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Computer Programming and Analysis")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "AI Roadmap" }));
    expect(screen.getByText("llama.cpp")).toBeInTheDocument();
    expect(screen.getByText("planned-v2")).toBeInTheDocument();
  });

  it("opens the AI Chat tab and sends a message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/chat-config.json")) {
          return new Response(JSON.stringify({ enabled: true }));
        }
        if (url.endsWith("/health")) {
          return new Response(JSON.stringify({ status: "ok", service: "portfolio-api" }));
        }
        if (url.endsWith("/profile")) {
          return new Response(JSON.stringify(profile));
        }
        if (url.endsWith("/chat")) {
          // POST /chat
          return new Response(
            JSON.stringify({ requestId: "abc123", status: "DONE", message: "Hello! How can I help?", sanitized: true }),
          );
        }
        if (url.includes("/chat/")) {
          // GET /chat/{requestId}
          return new Response(
            JSON.stringify({ status: "DONE", message: "Hello! How can I help?" }),
          );
        }
        return new Response("Not found", { status: 404 });
      }),
    );

    render(<App />);

    // Open the global chat widget
    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    expect(
      await screen.findByRole("heading", { name: "AI Chat" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No messages yet. Send a message to start the conversation!")).toBeInTheDocument();

    // Type a message and send
    const textarea = document.querySelector("textarea.chat-input") as HTMLTextAreaElement;
    await user.click(textarea!);
    await user.type(textarea!, "Tell me about your skills");
    await user.click(screen.getByRole("button", { name: "Send" }));

    // Verify user and assistant messages appear
    const chatMessages = document.querySelector(".chat-messages") as HTMLElement;
    expect(chatMessages!.textContent).toContain("Me:");
    expect(chatMessages!.textContent).toContain("Tell me about your skills");
    expect(chatMessages!.textContent).toContain("AI:");
    expect(chatMessages!.textContent).toContain("Hello! How can I help");
  });

  it("does not call chat APIs when chat config is disabled", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/chat-config.json")) {
        return new Response(
          JSON.stringify({ enabled: false, message: "Chat is currently offline." }),
        );
      }
      if (url.endsWith("/health")) {
        return new Response(JSON.stringify({ status: "ok", service: "portfolio-api" }));
      }
      if (url.endsWith("/profile")) {
        return new Response(JSON.stringify(profile));
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    expect(await screen.findByText("Chat is currently offline.")).toBeInTheDocument();

    const textarea = document.querySelector("textarea.chat-input") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    const chatApiCalls = fetchMock.mock.calls.filter(([url]) => {
      const value = String(url);
      return value.includes("/chat") && !value.includes("/chat-config.json");
    });
    expect(chatApiCalls).toHaveLength(0);
  });

  it("shows an API failure state when the health check fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("offline", { status: 503 })),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("API offline")).toBeInTheDocument());
  });

  it("keeps the global chat widget mounted while switching portfolio tabs", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/chat-config.json")) {
          return new Response(JSON.stringify({ enabled: true }));
        }
        if (url.endsWith("/health")) {
          return new Response(JSON.stringify({ status: "ok", service: "portfolio-api" }));
        }
        if (url.endsWith("/profile")) {
          return new Response(JSON.stringify(profile));
        }
        return new Response("Not found", { status: 404 });
      }),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    await user.type(screen.getByPlaceholderText("Type a message..."), "Keep this draft");

    await user.click(screen.getByRole("button", { name: "Projects" }));
    expect(await screen.findByText("NoraHangul")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep this draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Computer Programming and Analysis")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep this draft")).toBeInTheDocument();
  });
});
