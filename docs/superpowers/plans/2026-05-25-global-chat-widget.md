# Global Chat Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the AI chat experience from a route/tab-local view into a persistent global floating widget so tab navigation does not abandon active chat requests.

**Architecture:** Keep the current AWS async relay unchanged: React posts to API Gateway/Lambda, Lambda stores PENDING in DynamoDB and queues SQS, the Mac launchctl local agent processes SQS and writes DONE/ERROR. The frontend change is only UI/state ownership: chat state and polling move into a global component mounted once by `App`, outside the `activeView` conditional rendering.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, existing `frontend/src/chatApi.ts`, existing `frontend/src/chatConfig.ts`, existing AWS backend.

---

## Hard Scope Rules

- Do not add a cancel API in this phase.
- Do not modify Lambda routes for `/chat` unless a test proves the frontend cannot work without it.
- Do not modify SQS/DynamoDB infrastructure in this phase.
- Do not modify `.rpiv/`, generated design artifacts, or unrelated docs.
- Do not commit `.env.local-ai`, `.agent/`, model files, or local absolute machine-specific config.
- Keep the current launchctl agent workflow from PR #9 intact.
- Keep `AI Roadmap` as an informational page.
- Remove or repurpose the `AI Chat` tab only after the global widget is working and tested.

## Current Baseline To Assume

- Branch should be based on the latest `hotfix/chat-toggle-cloudfront-sync` or the branch that contains PR #9.
- `scripts/start-agent.sh` starts the model container and launchctl agent.
- `scripts/stop-agent.sh` disables frontend chat config, disables Lambda intake, unloads launchctl, and stops Docker.
- `frontend/src/App.tsx` currently owns `activeView`, `chatConfig`, and renders `<AiChatView />` only when `activeView === "ai-chat"`.
- `frontend/src/chatApi.ts` currently exports `postChat()`, `pollChat()`, `PollTimeoutError`, and response types.
- `frontend/src/styles.css` already contains `.chat-card`, `.chat-messages`, `.chat-bubble`, `.chat-input-area`, `.chat-input`, `.chat-send-btn`.

## File Map

- Modify `frontend/src/App.tsx`
  - Remove chat state from route-local `AiChatView`.
  - Mount a new global chat widget once, outside `<main>`.
  - Remove the `AI Chat` nav tab after tests are updated.

- Create `frontend/src/GlobalChatWidget.tsx`
  - Own all chat messages, active request, loading state, error state, input state, minimized/open state.
  - Use `chatConfig` from props.
  - Continue polling even when user switches Home/Projects/Resume/AI Roadmap.

- Modify `frontend/src/chatApi.ts`
  - No contract changes required.
  - Optionally export `ChatMessageStatus` type only if needed by tests.

- Modify `frontend/src/App.test.tsx`
  - Test global widget persists across tab navigation.
  - Test offline config disables global widget API calls.
  - Remove old route-only `AI Chat` expectations.

- Create `frontend/src/GlobalChatWidget.test.tsx`
  - Unit tests for open/minimize, send/poll success, error state, offline state.

- Modify `frontend/src/styles.css`
  - Add floating widget styles.
  - Reuse existing chat bubble styles where possible.
  - Keep responsive layout stable on mobile.

---

## Task 1: Extract A Global Chat Widget Component

**Files:**
- Create: `frontend/src/GlobalChatWidget.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/GlobalChatWidget.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `frontend/src/GlobalChatWidget.test.tsx` with this initial test:

```tsx
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
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd frontend
npm test -- --run src/GlobalChatWidget.test.tsx
```

Expected result:

```text
FAIL src/GlobalChatWidget.test.tsx
Failed to resolve import "./GlobalChatWidget"
```

- [ ] **Step 3: Implement minimal `GlobalChatWidget` shell**

Create `frontend/src/GlobalChatWidget.tsx`:

```tsx
import { useState } from "react";

import type { ChatConfig } from "./chatConfig";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function GlobalChatWidget({ chatConfig }: { chatConfig: ChatConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  if (!isOpen) {
    return (
      <button
        aria-label="Open AI chat"
        className="chat-fab"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        AI
      </button>
    );
  }

  return (
    <aside className="global-chat-panel" aria-label="AI chat">
      <div className="global-chat-header">
        <h2>AI Chat</h2>
        <button
          aria-label="Minimize AI chat"
          type="button"
          onClick={() => setIsOpen(false)}
        >
          -
        </button>
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>
              {chatConfig.enabled
                ? "No messages yet. Send a message to start the conversation!"
                : chatConfig.message}
            </p>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message..."
          disabled={!chatConfig.enabled}
          rows={2}
        />
        <button
          className="chat-send-btn"
          disabled={!chatConfig.enabled || !input.trim()}
          type="button"
        >
          Send
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run the component test**

Run:

```bash
cd frontend
npm test -- --run src/GlobalChatWidget.test.tsx
```

Expected result:

```text
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/GlobalChatWidget.tsx frontend/src/GlobalChatWidget.test.tsx
git commit -m "feat: add global chat widget shell"
```

---

## Task 2: Move Chat Send And Polling Into The Global Widget

**Files:**
- Modify: `frontend/src/GlobalChatWidget.tsx`
- Test: `frontend/src/GlobalChatWidget.test.tsx`

- [ ] **Step 1: Add failing send/poll success test**

Append this test inside `describe("GlobalChatWidget", ...)`:

```tsx
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
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd frontend
npm test -- --run src/GlobalChatWidget.test.tsx
```

Expected result:

```text
FAIL
Unable to find text /Me:/
```

- [ ] **Step 3: Implement send and polling**

Replace `frontend/src/GlobalChatWidget.tsx` with:

```tsx
import { useState } from "react";

import { PollTimeoutError, pollChat, postChat, type ChatResponse } from "./chatApi";
import type { ChatConfig } from "./chatConfig";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function GlobalChatWidget({ chatConfig }: { chatConfig: ChatConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !chatConfig.enabled) {
      return;
    }

    setMessages((previous) => [...previous, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await postChat(trimmed);

      if (response.status === "DONE") {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: response.message ?? "Processing complete." },
        ]);
        return;
      }

      for await (const update of pollChat(response.requestId)) {
        if (update.status === "DONE") {
          setMessages((previous) => [
            ...previous,
            { role: "assistant", content: update.message || "Processing complete." },
          ]);
          break;
        }

        if (update.status === "ERROR") {
          setError(update.message || "Processing failed. Please try again.");
          break;
        }
      }
    } catch (err) {
      if (err instanceof PollTimeoutError) {
        setError("The local agent is offline or timed out. Please try again later.");
      } else {
        setError("Failed to send message. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        aria-label="Open AI chat"
        className="chat-fab"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        AI
      </button>
    );
  }

  return (
    <aside className="global-chat-panel" aria-label="AI chat">
      <div className="global-chat-header">
        <h2>AI Chat</h2>
        <button
          aria-label="Minimize AI chat"
          type="button"
          onClick={() => setIsOpen(false)}
        >
          -
        </button>
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>
              {chatConfig.enabled
                ? "No messages yet. Send a message to start the conversation!"
                : chatConfig.message}
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
            <strong>{message.role === "user" ? "Me: " : "AI: "}</strong>
            {message.content}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble assistant loading">
            <strong>AI: </strong>
            <span className="typing-indicator">Thinking...</span>
          </div>
        )}
      </div>

      {error && <div className="chat-error" role="alert">{error}</div>}

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={loading || !chatConfig.enabled}
          rows={2}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={loading || !input.trim() || !chatConfig.enabled}
          type="button"
        >
          Send
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run the component tests**

Run:

```bash
cd frontend
npm test -- --run src/GlobalChatWidget.test.tsx
```

Expected result:

```text
2 passed
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/GlobalChatWidget.tsx frontend/src/GlobalChatWidget.test.tsx
git commit -m "feat: wire global chat widget to async chat API"
```

---

## Task 3: Mount The Widget Globally And Remove The Route-Local Chat Tab

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Add failing persistence test**

In `frontend/src/App.test.tsx`, add this test:

```tsx
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
```

- [ ] **Step 2: Run the failing App test**

Run:

```bash
cd frontend
npm test -- --run src/App.test.tsx
```

Expected result:

```text
FAIL
Unable to find role button named "Open AI chat"
```

- [ ] **Step 3: Modify `App.tsx`**

Make these edits:

1. Import the widget:

```tsx
import { GlobalChatWidget } from "./GlobalChatWidget";
```

2. Change the `View` type:

```tsx
type View = "home" | "projects" | "resume" | "ai";
```

3. Remove the `AI Chat` nav button:

```tsx
// Delete the NavButton with label="AI Chat"
```

4. Remove the route-local render:

```tsx
// Delete:
// {activeView === "ai-chat" && <AiChatView profile={profile} chatConfig={chatConfig} />}
```

5. Mount the global widget after `</main>`:

```tsx
      </main>
      <GlobalChatWidget chatConfig={chatConfig} />
```

6. Delete the entire `AiChatView` function from `App.tsx`.

- [ ] **Step 4: Run App tests**

Run:

```bash
cd frontend
npm test -- --run src/App.test.tsx
```

Expected result:

```text
PASS
```

If old tests still expect an `AI Chat` nav tab, update them to use the global `Open AI chat` button.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: mount chat widget globally"
```

---

## Task 4: Add Offline And Error State Tests

**Files:**
- Modify: `frontend/src/GlobalChatWidget.test.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Add offline widget test**

Append to `frontend/src/GlobalChatWidget.test.tsx`:

```tsx
it("disables input and avoids API calls when chat is offline", async () => {
  const user = userEvent.setup();
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  render(<GlobalChatWidget chatConfig={{ enabled: false, message: "Chat is currently offline." }} />);

  await user.click(screen.getByRole("button", { name: "Open AI chat" }));

  expect(screen.getByText("Chat is currently offline.")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Type a message...")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(fetchSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add polling error test**

Append to `frontend/src/GlobalChatWidget.test.tsx`:

```tsx
it("shows an error when the backend returns ERROR", async () => {
  const user = userEvent.setup();

  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const target = String(url);

    if (target.endsWith("/chat") && init?.method === "POST") {
      return new Response(JSON.stringify({
        requestId: "chat_error",
        status: "PENDING",
      }));
    }

    if (target.includes("/chat/chat_error")) {
      return new Response(JSON.stringify({
        requestId: "chat_error",
        status: "ERROR",
        message: "The local model timed out. Please try again.",
        sanitized: false,
      }));
    }

    return new Response("not found", { status: 404 });
  });

  render(<GlobalChatWidget chatConfig={{ enabled: true, message: "Chat is online." }} />);

  await user.click(screen.getByRole("button", { name: "Open AI chat" }));
  await user.type(screen.getByPlaceholderText("Type a message..."), "Hello");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("The local model timed out");
});
```

- [ ] **Step 3: Run widget tests**

Run:

```bash
cd frontend
npm test -- --run src/GlobalChatWidget.test.tsx
```

Expected result:

```text
4 passed
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/GlobalChatWidget.test.tsx
git commit -m "test: cover global chat offline and error states"
```

---

## Task 5: Style The Floating Widget

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add styles**

Append these styles to `frontend/src/styles.css`:

```css
.chat-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 50;
  width: 58px;
  height: 58px;
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 0;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px);
  cursor: pointer;
}

.global-chat-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 50;
  width: min(390px, calc(100vw - 32px));
  max-height: min(680px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 8px;
  background: rgba(12, 18, 30, 0.72);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(22px);
  overflow: hidden;
}

.global-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.global-chat-header h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0;
}

.global-chat-header button {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  cursor: pointer;
}

.global-chat-panel .chat-messages {
  min-height: 280px;
  max-height: 420px;
  overflow-y: auto;
}

@media (max-width: 640px) {
  .chat-fab {
    right: 16px;
    bottom: 16px;
  }

  .global-chat-panel {
    right: 12px;
    bottom: 12px;
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }
}
```

- [ ] **Step 2: Run build**

Run:

```bash
cd frontend
npm run build
```

Expected result:

```text
✓ built
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: add floating global chat widget"
```

---

## Task 6: Final Verification

**Files:**
- No new files unless tests fail.

- [ ] **Step 1: Run frontend tests**

```bash
cd frontend
npm test -- --run
```

Expected:

```text
Test Files passed
Tests passed
```

- [ ] **Step 2: Run frontend build**

```bash
cd frontend
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 3: Run focused backend tests**

```bash
PYTHONPATH=local_ai/harness .venv/bin/python -m pytest \
  local_ai/harness/tests/unit/test_sqs_agent.py \
  local_ai/harness/tests/unit/test_container_backend.py \
  -q
```

Expected:

```text
30 passed
```

- [ ] **Step 4: Manual local runtime check**

Start frontend:

```bash
cd frontend
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Check:

- Global `AI` floating button appears on Home.
- Open widget, type a draft, switch Projects/Resume/AI Roadmap, draft remains.
- Send one message with local agent running.
- Widget displays assistant answer.
- SQS visible/in-flight returns to 0/0.

- [ ] **Step 5: Commit final cleanup if needed**

Only if verification required small fixes:

```bash
git add frontend/src/App.tsx frontend/src/GlobalChatWidget.tsx frontend/src/GlobalChatWidget.test.tsx frontend/src/App.test.tsx frontend/src/styles.css
git commit -m "fix: polish global chat widget behavior"
```

---

## Local AI Execution Prompt

Use this prompt when handing the plan to a local coding agent:

```text
Read and execute docs/superpowers/plans/2026-05-25-global-chat-widget.md.

Use only the tasks in the plan. Implement task by task.

Required behavior:
- Build a persistent global floating chat widget.
- Do not implement cancel APIs.
- Do not modify .rpiv, generated artifacts, AWS infrastructure, SQS/DynamoDB schema, or unrelated docs.
- Do not commit .env.local-ai, .agent, model files, or local machine secrets.
- Use TDD exactly as written: write failing test, run it, implement, run tests, commit.
- Stop after each task commit and report changed files, test result, and commit hash.

Base branch should include PR #9 / hotfix/chat-toggle-cloudfront-sync behavior.
If the working tree is dirty before starting, stop and report it.
```

## Review Checklist For Codex After Local AI Finishes

- Confirm no cancel route or `CANCELLED` enum was added.
- Confirm `GlobalChatWidget` is mounted once in `App`.
- Confirm chat state is not inside an `activeView === ...` branch.
- Confirm `AI Chat` nav tab is removed or no longer route-local.
- Confirm offline config prevents POST `/chat`.
- Confirm tab switching preserves draft and active chat messages.
- Confirm frontend tests and build pass.
- Confirm focused SQS/agent backend tests still pass.
- Confirm no `.env.local-ai`, `.agent`, `.rpiv`, model files, or secrets were committed.

