import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const profile = {
  name: "Shinseong Kim",
  headline:
    "A Computer Programming student building full-stack projects with React, AWS serverless, and local LLM AI.",
  summary: "AWS-focused portfolio profile.",
  email: "skim570@myseneca.ca",
  projects: [
    {
      name: "NoraHangul.com",
      tag: "Spring Boot / React, AWS #Docker",
      description: "Student management system.",
    },
    {
      name: "Shinseong.dev",
      tag: "AWS / Lambda / SAM",
      description: "Serverless portfolio backend.",
    },
    {
      name: "GS Power Legacy Website",
      tag: "HTML / CSS / JavaScript / Corporate Website",
      description: "Legacy corporate website project.",
    },
    {
      name: "Lofi Nest",
      tag: "HTML / CSS / JavaScript / Music App",
      description: "Legacy music app portfolio project.",
    },
    {
      name: "Pixels Legacy Media Website",
      tag: "HTML / CSS / JavaScript / Media Website",
      description: "Legacy media website portfolio project.",
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
    window.history.replaceState(null, "", "/");
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
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

    expect(screen.getByRole("heading", { name: "Hi, I'm Shinseong Kim." })).toBeInTheDocument();
    expect(await screen.findByText("API connected")).toBeInTheDocument();
    expect(screen.queryByText("AWS Certified Solutions Architect Associate")).not.toBeInTheDocument();
  });

  it("switches between Projects, Resume, and AI Chat tabs", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Projects" }));
    expect(await screen.findByRole("heading", { name: "NoraHangul.com" })).toBeInTheDocument();
    expect(container.querySelector(".project-img")).not.toBeInTheDocument();
    expect(container.querySelector(".projects-grid")).toBeInTheDocument();
    expect(screen.queryByText("Spring Boot / React, AWS #Docker")).not.toBeInTheDocument();
    const awsFilter = screen.getByRole("button", { name: "#AWS" });
    const noraCard = screen.getByRole("article", { name: "NoraHangul.com" });
    const cloudCard = screen.getByRole("article", { name: "Shinseong.dev" });
    expect(screen.getByRole("button", { name: "#Spring Boot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "#React" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "#Docker" })).toBeInTheDocument();
    expect(within(noraCard).getByText("Spring Boot")).toBeInTheDocument();
    expect(within(noraCard).getByText("React")).toBeInTheDocument();
    expect(within(noraCard).getByText("Docker")).toBeInTheDocument();
    expect(awsFilter).toHaveStyle(
      within(noraCard).getByText("AWS").getAttribute("style") ?? "",
    );
    expect(awsFilter).toHaveStyle(
      within(cloudCard).getByText("AWS").getAttribute("style") ?? "",
    );
    await user.click(screen.getByRole("button", { name: "#React" }));
    expect(screen.getByRole("heading", { name: "NoraHangul.com" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Shinseong.dev" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByRole("heading", { name: "Shinseong.dev" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NoraHangul.com demo" })).toHaveAttribute(
      "href",
      "https://norahangul.com",
    );
    expect(screen.getByRole("link", { name: "NoraHangul.com GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/moosewithwolf/student-mangement-app-demo",
    );
    expect(screen.getByRole("link", { name: "GS Power Legacy Website demo" })).toHaveAttribute(
      "href",
      "https://legacy-corporate-portfolio.vercel.app/",
    );
    expect(screen.queryByRole("link", { name: "GS Power Legacy Website GitHub" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lofi Nest demo" })).toHaveAttribute(
      "href",
      "https://legacy-music-app-portfolio.vercel.app/",
    );
    expect(screen.queryByRole("link", { name: "Lofi Nest GitHub" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pixels Legacy Media Website demo" })).toHaveAttribute(
      "href",
      "https://legacy-media-portfolio.vercel.app/",
    );
    expect(screen.queryByRole("link", { name: "Pixels Legacy Media Website GitHub" })).not.toBeInTheDocument();
    expect(screen.queryByText("D")).not.toBeInTheDocument();
    expect(screen.queryByText("GH")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#projects");

    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Computer Programming and Analysis")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Education / Awards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Certifications" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Volunteer Experience" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work Experience" })).toBeInTheDocument();
    expect(document.querySelector('[data-share-badge-id="134705ce-abad-4781-aa66-7024675ec676"]')).toHaveAttribute(
      "data-share-badge-host",
      "https://www.credly.com",
    );
    expect(document.querySelector('[data-share-badge-id="64c563c4-ad51-47b7-ade7-ba18267549c1"]')).toHaveAttribute(
      "data-iframe-height",
      "270",
    );
    expect(document.querySelector('script[src="https://cdn.credly.com/assets/utilities/embed.js"]')).toBeInTheDocument();
    expect(screen.getByText("Executive of CodeXperts")).toBeInTheDocument();
    expect(screen.getByText("Housekeeping Supervisor")).toBeInTheDocument();
    expect(screen.getByText("Customs Specialist")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "AI Chat" }));
    expect(screen.getByRole("heading", { name: "Portfolio AI" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Chat history" })).toBeInTheDocument();
    expect(screen.getByText("Gemma 2B IT Q4_K_M")).toBeInTheDocument();
    expect(window.location.hash).toBe("#ai-chat");
  });

  it("opens the view from the current URL hash", async () => {
    window.history.replaceState(null, "", "/#resume");

    render(<App />);

    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toHaveClass("active");
  });

  it("minimizes the floating chat widget when opening the AI Chat tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open AI chat" }));
    expect(await screen.findByLabelText("Floating AI chat")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "AI Chat" }));

    expect(screen.queryByLabelText("Floating AI chat")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open AI chat" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Portfolio AI" })).toBeInTheDocument();
  });

  it("stores full-page AI chat history in localStorage", async () => {
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
          return new Response(JSON.stringify({ requestId: "abc123", status: "DONE", message: "Portfolio answer." }));
        }
        return new Response("Not found", { status: 404 });
      }),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "AI Chat" }));
    const conversation = screen.getByLabelText("Portfolio AI conversation");
    await user.type(
      within(conversation).getByPlaceholderText("Ask about projects, AWS, backend work..."),
      "Tell me about NoraHangul",
    );
    await user.click(within(conversation).getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(conversation.textContent).toContain("Portfolio answer.");
    });
    expect(screen.getByRole("button", { name: "Tell me about NoraHangul" })).toBeInTheDocument();
    expect(localStorage.getItem("portfolio-ai-chat-sessions")).toContain("Tell me about NoraHangul");
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
    await waitFor(() => {
      expect(chatMessages!.textContent).toContain("AI:");
      expect(chatMessages!.textContent).toContain("Hello! How can I help");
    });
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
    expect(await screen.findByText("NoraHangul.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep this draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Computer Programming and Analysis")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep this draft")).toBeInTheDocument();
  });

  describe("navigation (Task 3A)", () => {
    it('clicking "Explore Work" changes visible view to Projects and updates window.location.hash to #projects', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => expect(screen.getByText("API connected")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Explore Work" }));

      expect(await screen.findByText("Featured Projects")).toBeInTheDocument();
      expect(window.location.hash).toBe("#projects");
    });

    it("clicking nav buttons updates the URL hash and Home clears it", async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/");

      render(<App />);

      await user.click(screen.getByRole("button", { name: "Projects" }));
      expect(await screen.findByText("Featured Projects")).toBeInTheDocument();
      expect(window.location.hash).toBe("#projects");

      await user.click(screen.getByRole("button", { name: "Resume" }));
      expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
      expect(window.location.hash).toBe("#resume");

      await user.click(screen.getByRole("button", { name: "AI Chat" }));
      expect(screen.getByRole("heading", { name: "Portfolio AI" })).toBeInTheDocument();
      expect(window.location.hash).toBe("#ai-chat");

      await user.click(screen.getByRole("button", { name: "Home" }));

      expect(screen.getByRole("heading", { name: "Hi, I'm Shinseong Kim." })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Featured Projects" })).not.toBeInTheDocument();
      expect(window.location.hash).toBe("");
    });

    it("browser Back and Forward via popstate update the active view to match the URL hash", async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/#resume");

      render(<App />);

      expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Resume" })).toHaveClass("active");

      // Navigate forward via nav click
      await user.click(screen.getByRole("button", { name: "Projects" }));
      expect(await screen.findByText("Featured Projects")).toBeInTheDocument();
      expect(window.location.hash).toBe("#projects");

      window.history.replaceState(null, "", "/#resume");
      window.dispatchEvent(new PopStateEvent("popstate"));

      expect(await screen.findByRole("heading", { name: "Skills" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Resume" })).toHaveClass("active");

      window.history.replaceState(null, "", "/#projects");
      window.dispatchEvent(new PopStateEvent("popstate"));

      expect(await screen.findByText("Featured Projects")).toBeInTheDocument();
      expect(window.location.hash).toBe("#projects");
      expect(screen.getByRole("button", { name: "Projects" })).toHaveClass("active");
    });
  });
});
