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

  it("shows an API failure state when the health check fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("offline", { status: 503 })),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("API offline")).toBeInTheDocument());
  });
});
