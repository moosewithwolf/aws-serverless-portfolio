---
date: "2026-05-24T19:59:24-0400"
author: Shinseong Kim
commit: 2798a53
branch: main
repository: aws-serverless-portfolio copy
topic: "V2 Local AI Chatbot Harness Design"
tags: [design, local-ai, chatbot, harness, prompt-injection, docker, lambda, sam, vertical-slices]
status: complete
parent: ".rpiv/artifacts/research/2026-05-24_19-13-45_v2-local-ai-chatbot-harness.md"
last_updated: "2026-05-24T21:00:00-0400"
last_updated_by: Shinseong Kim
last_updated_note: "All 5 slices generated and verified; frontend tests 4/4 pass, backend handler tests 8/8 pass, existing backend tests 4/4 pass"
---

# Design: V2 Local AI Chatbot Harness

## Summary
Add a visitor-facing AI chat feature to the portfolio site. Visitors submit messages via the frontend chat UI, which POSTs to a new `LocalAiFunction` Lambda (`/chat`). The Lambda delegates to a Python harness with a mock model backend (keyword-based routing), regex safety validation (input + output + context files), and snake_case→camelCase JSON serialization. Status polling uses `GET /chat/{requestId}`. The frontend adds `"ai-chat"` as a sibling `View` enum value with a corresponding inline view component in `App.tsx`.

## Requirements
- Frontend: New `ai-chat` view with chat UI (message list, input, send button)
- Frontend: Dedicated `chatApi.ts` module with `postChat()` and async generator `pollChat()`
- Backend: New `LocalAiFunction` SAM Lambda with `POST /chat` and `GET /chat/{requestId}` routes
- Harness: Modular Python package (`local_ai/harness/`) with contract types, mock backend, safety validation, prompt builder
- Contract: `snake_case`→`camelCase` JSON serialization for API compliance
- Contract: `ChatResponse` includes `sanitized: bool` field
- Tests: Frontend vitest for chat UI; backend pytest for Lambda handler
- CSS: Chat-specific styles (message bubbles, input area, scrollable container)

## Current State Analysis
### Key Discoveries
- **Frontend routing** (`frontend/src/App.tsx:6`): `View = "home" | "projects" | "resume" | "ai"` — single-state `activeView` enum, no router library. New views add a union member + conditional render branch.
- **NavButton** (`App.tsx:100-113`): Accepts any `View` value, calls `setActiveView(view)` + `window.scrollTo()`. No refactoring needed.
- **API client** (`frontend/src/api.ts:33-36`): Generic `request<T>()` only supports GET with no body. Chat operations (POST, polling) need a dedicated module.
- **Test setup** (`frontend/src/test/setup.ts`): vitest with `@testing-library/jest-dom/vitest`, `window.scrollTo` mock, `globals: true`.
- **Test patterns** (`frontend/src/App.test.tsx`): `beforeEach` + `vi.stubGlobal("fetch", ...)` per-test mock, `render` + `screen` assertions, `userEvent` for interaction.
- **Backend handler** (`backend/hello_world/app.py:29-56`): Monolithic if/elif routing. `_response()` envelope wraps payload in `{"statusCode", "headers", "body: json.dumps(...)"}`. OPTIONS returns 204, non-GET returns 405.
- **SAM template** (`backend/template.yaml`): `Globals.Function.Timeout: 3`. Each function is a top-level `AWS::Serverless::Function` resource with `CodeUri` (relative to template), `Handler`, `Events` block.
- **Test patterns** (`backend/tests/unit/test_handler.py`): `invoke(path, method)` helper constructs dual-format Lambda event; `body(response)` decodes JSON string. No `conftest.py` anywhere — fixtures are inline in test files.
- **CORS** (`app.py:3-8`): `Access-Control-Allow-Methods: "GET,OPTIONS"` — needs POST for chat.

### Constraints to Work Within
- No React Router — all views are inline function components in `App.tsx` (Pattern: `AiRoadmapView` at `App.tsx:176-203`)
- All views use `<section className="view active">` root element
- CSS is a single global `styles.css` — no modules, no CSS-in-JS
- SAM auto-creates API Gateway + IAM roles from `Events` — no explicit resources needed
- `pyproject.toml` does not exist anywhere — project uses flat `requirements.txt` per subproject
- Lambda handler envelope uses `json.dumps()` — body is always a JSON string, never a nested object

## Scope
### Building
- `frontend/src/chatApi.ts` — `ChatRequest`, `ChatResponse`, `ChatStatusResponse` types; `postChat()` and `pollChat()` async generator
- `frontend/src/App.tsx` — `"ai-chat"` View enum member, NavButton, conditional render, `AiChatView` inline component
- `frontend/src/App.test.tsx` — Chat tab test (click nav button, verify messages appear)
- `frontend/src/styles.css` — Chat-specific styles (message list, input, bubbles, scroll)
- `local_ai/harness/` — Top-level sibling package with:
  - `contracts.py` — `ChatRequest`, `ChatResponse`, `ChatStatusResponse` Pydantic models
  - `mock_backend.py` — `ModelBackend` Protocol, `MockModelBackend` with keyword routing
  - `safety.py` — Regex-based safety validation (input, output, context file scanning)
  - `prompt_builder.py` — Sorted context file loading with `lru_cache`
  - `app.py` — Lambda handler: route POST to harness, serialize snake_case→camelCase
  - `requirements.txt` — Python dependencies
  - `tests/unit/test_handler.py` — Handler unit tests
- `backend/template.yaml` — New `LocalAiFunction` resource, POST/OPTIONS routes, timeout override, CORS update
- `.gitignore` — Add patterns for `local_ai/` secrets

### Not Building
- Docker container model client (`container_model_client.py`) — Deferred to Phase 2
- Rate limiting / throttling — Deferred to Phase 5
- CI/CD pipeline — Deferred to Phase 5
- DynamoDB request persistence — Deferred to Phase 4
- SQS-based async processing — Deferred to Phase 4
- CloudWatch log retention configuration — Deferred to Phase 5
- Actual safety service (e.g., AWS Bedrock Guardrails) — Regex-only for Phase 1
- Model weight management — Outside portfolio scope

## Decisions
### Separate Lambda for Chat
**Ambiguity**: Should chat go into the existing `PortfolioApiFunction` or a new Lambda?
**Explored**:
- **Option A (extend existing)**: Modify `app.py` to handle POST, update CORS Allow-Methods. Risk: pushes monolithic handler past 100 lines; breaks existing 405-non-GET guard; couples chat traffic to portfolio endpoints.
- **Option B (new Lambda)**: `LocalAiFunction` with `CodeUri: local_ai/harness/`. Clean import isolation, independent timeout/memory, no risk to existing routes.
**Decision**: Option B — Separate `LocalAiFunction`. Modeled after existing `PortfolioApiFunction` pattern (`template.yaml:14-39`).

### Inline Component in App.tsx
**Ambiguity**: Should `AiChatView` be a separate file or inline in `App.tsx`?
**Evidence**: All four existing views (`HomeView`, `ProjectsView`, `ResumeView`, `AiRoadmapView`) are inline function components in `App.tsx` (`App.tsx:134-289`). This is a firm project convention.
**Decision**: Inline in `App.tsx`. Matches existing pattern; zero new component files.

### Dedicated `chatApi.ts` Module
**Evidence**: `api.ts:33-36` `request<T>()` helper wraps `fetch()` with no method/body/headers — only supports GET. Chat needs POST + polling (async generator).
**Decision**: New `frontend/src/chatApi.ts` module. Reuses `apiBaseUrl` from `api.ts` via import.

### Top-level `local_ai/` Package
**Decision from research + developer context**: Top-level sibling to `backend/`. SAM's `CodeUri` resolution works cleanly; separate `requirements.txt` avoids dependency conflicts.

### `sanitized: bool` on ChatResponse
**Decision from research + developer context**: Yes, for audit trails and downstream filtering.

### snake_case → camelCase Serialization
**Critical contract gap**: Python models use snake_case (`request_id`, `model_name`). API Gateway envelope expects camelCase for frontend consumption.
**Decision**: Lambda handler transforms keys before `json.dumps()`. Manual key mapping (not Pydantic `by_alias` — keeps harness dependency-free for Phase 1).

### Lambda Timeout
**Current**: Global 3 seconds (`template.yaml:12`).
**Decision**: 30 seconds for `LocalAiFunction` (mock backend is fast; leaves headroom for container model in future phases).

### Polling Interval
**Decision**: 2 seconds default — balances responsiveness with API Gateway throttling limits.

### Context File Loading
**Decision**: Explicit sorted list (`profile.md`, `projects.md`, `resume.md`) — NOT raw `glob`. Lazy loading with `@functools.lru_cache(maxsize=1)`. Path resolution: `Path(__file__).parent.parent` (relative to module, not CWD).

### Safety Validation
**Input**: Empty rejection, credential exfiltration (`AKIA` pattern), prompt injection (`ignore.*instructions`), tool-use (`oMLX`, `pi`, `Hermes`, `shell`), file access (`/etc`, `.ssh`, `.aws`, `$HOME`).
**Output**: Prompt leakage detection, forbidden resource claims.
**Context files**: Secret scanning before prompt builder loads.

## Architecture
### frontend/src/chatApi.ts — NEW
Dedicated API client for chat operations. Exports types + `postChat()` (POST) + `pollChat()` (async generator, GET polling until terminal status). Reuses `apiBaseUrl` from `api.ts`.

```ts
/**
 * Chat API module for the Local AI Chatbot.
 *
 * Provides typed request/response models and HTTP operations:
 * - `postChat()` — POST a message and receive a request ID
 * - `pollChat()` — async generator that polls GET /chat/{requestId}
 *   until the status reaches a terminal state (DONE or FAILED).
 *
 * Reuses `apiBaseUrl` from `./api` so both modules target the same endpoint.
 */

import { apiBaseUrl } from "./api";

// ---------------------------------------------------------------------------
// Types (mirror local_ai/harness/harness/contracts.py)
// ---------------------------------------------------------------------------

export type ChatRequest = {
  message: string;
};

export type ChatResponse = {
  requestId: string;
  status: "PENDING" | "DONE" | "FAILED";
  message: string;
  sanitized: boolean;
};

export type ChatStatusResponse = {
  status: "PENDING" | "DONE" | "FAILED";
  message: string;
};

// ---------------------------------------------------------------------------
// POST — Submit a chat message
// ---------------------------------------------------------------------------

/**
 * POST /chat — submits a message and returns the initial response
 * (usually with status "PENDING" and a requestId for polling).
 */
export async function postChat(message: string): Promise<ChatResponse> {
  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Chat POST failed: ${response.status}`);
  }

  return (await response.json()) as ChatResponse;
}

// ---------------------------------------------------------------------------
// GET polling — async generator
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["DONE", "FAILED"]);

/**
 * Async generator that polls GET /chat/{requestId} until the status
 * reaches a terminal state (DONE or FAILED).
 *
 * Yields each `ChatStatusResponse` as it arrives.
 *
 * @example
 * ```ts
 * const initial = await postChat("Tell me about AWS");
 * for await (const update of pollChat(initial.requestId)) {
 *   console.log(update.status); // "PENDING" → "DONE"
 * }
 * ```
 */
export async function* pollChat(requestId: string): AsyncGenerator<ChatStatusResponse> {
  while (true) {
    const response = await fetch(`${apiBaseUrl}/chat/${requestId}`);

    if (!response.ok) {
      // If the request is not found, it may still be processing
      if (response.status === 404) {
        await delay(POLL_INTERVAL_MS);
        continue;
      }
      throw new Error(`Chat poll failed: ${response.status}`);
    }

    const update: ChatStatusResponse = await response.json();
    yield update;

    if (TERMINAL_STATUSES.has(update.status)) {
      break;
    }

    await delay(POLL_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### frontend/src/App.tsx — MODIFY
Add `"ai-chat"` to `View` union, new `NavButton`, conditional render branch, and `AiChatView` inline component. Full code is in Slice 5 section above.

### frontend/src/App.test.tsx — MODIFY
Add test for chat tab interaction (click nav button, verify chat messages render, send message flow). Full test code is in Slice 5 section above.

### frontend/src/styles.css — MODIFY
Append chat-specific styles: message container (scrollable), message bubbles (user/assistant variants), input area (textarea + send button), loading indicator (typing dots animation), responsive breakpoint for 768px. Full CSS code is in Slice 5 section above.

### local_ai/harness/harness/contracts.py — NEW
Pydantic models for the chat contract: `ChatRequest`, `ChatResponse`, `ChatStatusResponse`. Includes `sanitized: bool` on `ChatResponse`. Status enum: `PENDING`, `DONE`, `FAILED`.

```python
"""Contract models for the Local AI Chatbot harness.

Pydantic models that define the API contract between the Lambda handler
and the frontend, and between the harness and external callers.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ChatStatus(str, Enum):
    """Status of a chat request lifecycle."""

    PENDING = "PENDING"
    DONE = "DONE"
    FAILED = "FAILED"


class ChatRequest(BaseModel):
    """Incoming chat message from the frontend."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2048,
        description="The user's chat message.",
    )


class ChatResponse(BaseModel):
    """Response returned after processing a chat request."""

    request_id: str = Field(
        ...,
        description="Unique identifier for this chat request, used for polling.",
    )
    status: ChatStatus = Field(
        ...,
        description="Current processing status.",
    )
    message: str = Field(
        ...,
        description="Response text from the model (empty when PENDING).",
    )
    sanitized: bool = Field(
        ...,
        description="Whether the response passed safety validation.",
    )


class ChatStatusResponse(BaseModel):
    """Status update returned by the polling endpoint."""

    status: ChatStatus = Field(
        ...,
        description="Current processing status.",
    )
    message: str = Field(
        default="",
        description="Optional status message (e.g., error reason on FAILED).",
    )
```

### local_ai/harness/harness/mock_backend.py — NEW
`ModelBackend` Protocol (typing) with `generate(prompt: str) -> str`. `MockModelBackend` with keyword-based routing: `aws_architecture`, `certifications`, `projects`, `skills`, `education`, `prompt_injection`, `tool_runtime`, `credential_request`, `private_info`, `unavailable`. Priority-ordered security-sensitive pattern checks first.

```python
"""Mock model backend for the Local AI Chatbot harness.

Implements the `ModelBackend` Protocol with keyword-based routing
to return portfolio-relevant responses. Security-sensitive patterns
(injection, tool-use, credentials) are checked first.
"""

from __future__ import annotations

import re
from typing import Protocol


class ModelBackend(Protocol):
    def generate(self, prompt: str) -> str: ...


_RESPONSES: dict[str, str] = {
    "aws_architecture": (
        "My portfolio backend runs on AWS Lambda with API Gateway. "
        "The frontend is a React SPA hosted on S3 behind CloudFront. "
        "The SAM template defines routes for `/health` and `/profile`. "
        "This v2 adds a `LocalAiFunction` Lambda that processes chat messages"
        " through a Python harness with safety validation."
    ),
    "certifications": (
        "I hold two AWS certifications: AWS Solutions Architect Associate "
        "and AWS Developer Associate. I am currently studying Computer "
        "Programming and Analysis at Seneca Polytechnic with a 4.0 GPA."
    ),
    "projects": (
        "My two featured projects are:\n"
        "1. **NoraHangul** — A student management system built with "
        "Spring Boot, React, and AWS, featuring OAuth2/JWT authentication "
        "and Docker-based deployment.\n"
        "2. **Cloud Native Backend** — A serverless portfolio backend "
        "using API Gateway, Lambda, CloudFront, and S3, with a roadmap "
        "for local AI integration."
    ),
    "skills": (
        "My technical skills include Python, JavaScript, TypeScript, "
        "React, Spring Boot, AWS, Docker, PostgreSQL, and MongoDB. "
        "I specialize in high-performance serverless systems and full-stack engineering."
    ),
    "education": (
        "I am a Computer Programming and Analysis student at Seneca Polytechnic "
        "in Toronto, ON (2024 - Present). I graduated with a 4.0 GPA and "
        "received the Marcus Udokang Computer Science Award in 2026."
    ),
    "prompt_injection": (
        "I cannot process requests that attempt to override my system instructions. "
        "All inputs are validated against safety patterns before being sent to the model."
    ),
    "tool_runtime": (
        "I am an AI assistant and do not have access to a tool runtime, shell, "
        "or browser. I can only provide information and text-based responses "
        "about the portfolio, skills, projects, and AWS architecture."
    ),
    "credential_request": (
        "I do not have access to any credentials, API keys, or secret keys. "
        "Please do not share sensitive information such as AWS access keys, "
        "JWT tokens, or private SSH keys with me."
    ),
    "private_info": (
        "I cannot share private or personal information. My responses are "
        "limited to publicly available portfolio content."
    ),
    "unavailable": (
        "I'm not sure how to respond to that. Please ask about my "
        "skills, projects, certifications, education, or AWS architecture."
    ),
}

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"ignore.*instructions|bypass.*rule|act as.*not", re.IGNORECASE), "prompt_injection"),
    (re.compile(r"\\boMLX\\b|^\\bpi\\b|Hermes|shell|/bin/|eval\\(|exec\\(", re.IGNORECASE), "tool_runtime"),
    (re.compile(r"AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |DSA )?PRIVATE KEY|Bearer [a-zA-Z0-9_-]+"), "credential_request"),
    (re.compile(r"/etc/|\\.ssh/|\\.aws/|\\$HOME|/home/", re.IGNORECASE), "private_info"),
]


class MockModelBackend:
    def generate(self, prompt: str) -> str:
        for pattern, keyword in _PATTERNS:
            if pattern.search(prompt):
                return _RESPONSES[keyword]
        prompt_lower = prompt.lower()
        for keyword, response in _RESPONSES.items():
            if keyword in prompt_lower or keyword.replace("_", " ") in prompt_lower:
                return response
        return _RESPONSES["unavailable"]
```

### local_ai/harness/harness/safety.py — NEW
Regex-based safety validation for input, output, and context files. Patterns: credential exfiltration (`AKIA`), prompt injection, tool-use, file access, prompt leakage, forbidden resource claims. Returns `sanitized: bool`.

```python
"""Safety validation for the Local AI Chatbot harness.

Provides regex-based safety checks for:
- Input messages (pre-prompt validation)
- Model outputs (post-generation validation)
- Context files (secret scanning before prompt building)

Returns a boolean indicating whether the content passed all checks.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


_INPUT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^\\s*$"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"ignore.*instructions|bypass.*rule|act as.*not", re.IGNORECASE),
    re.compile(r"\\boMLX\\b|^\\bpi\\b|Hermes|shell|/bin/|eval\\(|exec\\(", re.IGNORECASE),
    re.compile(r"/etc/|\\.ssh/|\\.aws/|\\$HOME|/home/"),
]

_OUTPUT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"you are a helpful portfolio|you cannot share|you do not have access to", re.IGNORECASE),
    re.compile(r"I can (access|read|execute|run|list)\\s+(file|/etc|\\.ssh|\\.aws|shell|process)", re.IGNORECASE),
    re.compile(r"AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY"),
]

_CONTEXT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"),
    re.compile(r"eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+"),
    re.compile(r"(api[_-]?key|secret[_-]?key|password|token)\\s*[:=]\\s*['\\"]?[A-Za-z0-9+/=_-]{16,}"),
]


def validate_input(message: str) -> tuple[bool, str]:
    if not message or not message.strip():
        return False, "Empty messages are not allowed."
    if len(message) > 2048:
        return False, f"Message exceeds 2048 character limit ({len(message)} chars)."
    for pattern in _INPUT_PATTERNS:
        if pattern.search(message):
            return False, "Message contains patterns that may indicate injection, credential sharing, or restricted access requests."
    return True, ""


def validate_output(response: str) -> tuple[bool, str]:
    if len(response) > 4096:
        return False, "Response exceeds 4096 character limit."
    for pattern in _OUTPUT_PATTERNS:
        if pattern.search(response):
            return False, "Response contains patterns that may indicate prompt leakage or unauthorized resource claims."
    return True, ""


def validate_context_file(file_path: Path) -> tuple[bool, str]:
    try:
        content = file_path.read_text(encoding="utf-8")
    except OSError as e:
        return False, f"Cannot read context file: {e}"
    for pattern in _CONTEXT_PATTERNS:
        if pattern.search(content):
            return False, f"Context file '{file_path.name}' contains potential secrets or sensitive data."
    return True, ""


def validate_safety(content: str | Any, for_output: bool = False) -> bool:
    if isinstance(content, BaseModel):
        text = getattr(content, "message", str(content))
    else:
        text = str(content)
    if for_output:
        is_safe, _ = validate_output(text)
    else:
        is_safe, _ = validate_input(text)
    return is_safe
```

### local_ai/harness/harness/prompt_builder.py — NEW
Explicit sorted context file list, lazy loading with `@functools.lru_cache(maxsize=1)`, path resolution relative to module. Deterministic alphabetical ordering.

```python
"""Prompt builder for the Local AI Chatbot harness.

Loads portfolio context files in a deterministic, sorted order and
assembles them into a system prompt prefix. Files are loaded lazily
with an LRU cache so the I/O cost is paid only once per Lambda
invocation cold start.
"""

from __future__ import annotations

import functools
from pathlib import Path
from typing import Optional

_ROOT = Path(__file__).parent.parent  # local_ai/harness/

_CONTEXT_FILES: list[Path] = sorted(
    [_ROOT / "context" / "profile.md", _ROOT / "context" / "projects.md", _ROOT / "context" / "resume.md"],
    key=lambda p: p.name,
)


@functools.lru_cache(maxsize=1)
def load_context() -> Optional[str]:
    parts: list[str] = []
    for file_path in _CONTEXT_FILES:
        if file_path.exists():
            parts.append(f"--- {file_path.name} ---\\n{file_path.read_text(encoding='utf-8')}")
    return "\\n\\n".join(parts) if parts else None
```

### local_ai/harness/harness/app.py — NEW
Lambda handler: route POST `/chat` to harness, construct request, call mock backend, apply safety validation, build response with camelCase keys, return in API Gateway envelope. OPTIONS returns 204. Full code is in Slice 3 section above.

### local_ai/harness/tests/unit/test_handler.py — NEW
Handler unit tests following `invoke()` + `body()` pattern: POST returns PENDING/DONE, invalid payload returns error, OPTIONS returns CORS headers. Full code is in Slice 3 section above.

### local_ai/harness/requirements.txt — NEW
Python dependencies for harness.

```
pydantic>=2.0
```

### backend/template.yaml — MODIFY
Add `LocalAiFunction` resource with `CodeUri: ../local_ai/harness/`, `Handler: harness.app.lambda_handler`, `Runtime: python3.12`, `Timeout: 30`. Add `ChatPost`, `ChatOptions`, `ChatGet`, `ChatGetOptions` events. Update Outputs with new ARN references. Full code is in Slice 4 section above.

## Slices
### Slice 1: Contracts & API Client

**Files**: `local_ai/harness/harness/contracts.py` (NEW), `frontend/src/chatApi.ts` (NEW)

#### Automated Verification:
- [ ] Type checking passes: `npm run check` in frontend/
- [ ] `ChatRequest` type has `message: string` field
- [ ] `ChatResponse` type includes `sanitized: boolean` and `status: "PENDING" | "DONE" | "FAILED"`
- [ ] `ChatStatusResponse` type has `status` and `message` fields
- [ ] `postChat()` function POSTs to `/chat` endpoint
- [ ] `pollChat()` is an async generator yielding status updates

#### Manual Verification:
- [ ] `ChatRequest` / `ChatResponse` / `ChatStatusResponse` TS types match Python `ChatRequest` / `ChatResponse` / `ChatStatusResponse` model fields (camelCase ↔ snake_case mapping verified)

### Slice 2: Harness Core — Mock Backend + Safety

**Files**: `local_ai/harness/harness/__init__.py` (NEW), `local_ai/harness/harness/mock_backend.py` (NEW), `local_ai/harness/harness/safety.py` (NEW), `local_ai/harness/harness/prompt_builder.py` (NEW), `local_ai/harness/requirements.txt` (NEW)

#### Automated Verification:
- [ ] `ModelBackend` Protocol defined with `generate(prompt: str) -> str`
- [ ] `MockModelBackend` routes keywords: `aws_architecture`, `certifications`, `projects`, `skills`, `education`, `prompt_injection`, `tool_runtime`, `credential_request`, `private_info`, `unavailable`
- [ ] Safety validation catches credential pattern `AKIA[0-9A-Z]{16}`
- [ ] Safety validation catches prompt injection `ignore.*instructions`
- [ ] Safety validation catches file access patterns `/etc`, `.ssh`, `.aws`, `$HOME`
- [ ] Context files loaded in sorted order via explicit list (not glob)
- [ ] `requirements.txt` contains minimal deps (pydantic for models, stdlib otherwise)

#### Manual Verification:
- [ ] Mock backend responses are realistic and portfolio-relevant
- [ ] Safety patterns are comprehensive but not overly aggressive (no false positives on normal queries)

### Slice 3: Lambda Handler

**Files**: `local_ai/harness/harness/app.py` (NEW), `local_ai/harness/tests/unit/test_handler.py` (NEW)

#### Automated Verification:
- [ ] POST `/chat` routes to harness, returns PENDING response
- [ ] Response body has camelCase keys (`requestId`, `status`, `message`, `sanitized`)
- [ ] OPTIONS `/chat` returns 204 with CORS headers
- [ ] Invalid payload returns error response with 4xx status
- [ ] Handler tests follow `invoke()` + `body()` pattern from existing tests

#### Manual Verification:
- [ ] Lambda handler gracefully handles exceptions (no uncaught exceptions reaching API Gateway)
- [ ] Error responses include helpful `message` field

### Slice 4: SAM Infrastructure

**Files**: `backend/template.yaml` (MODIFY)

#### Automated Verification:
- [x] `LocalAiFunction` resource exists with `CodeUri: ../local_ai/harness/`
- [x] `Handler` points to `harness.app.lambda_handler`
- [x] `Timeout: 30` overrides global 3s default
- [x] POST `/chat` event defined (Method: post)
- [x] OPTIONS `/chat` event defined (Method: options)
- [x] GET `/chat/{requestId}` event defined (Method: get)
- [x] OPTIONS `/chat/{requestId}` event defined (Method: options)
- [x] CORS headers support POST method (via Lambda handler)
- [x] Outputs include `LocalAiFunction` and `LocalAiFunctionIamRole` references
- [x] Existing `PortfolioApiFunction` routes (Health, Profile) unchanged

#### Manual Verification:
- [x] Template YAML is valid (no syntax errors)
- [x] Existing routes (Health, Profile) unchanged

```yaml
# backend/template.yaml — added LocalAiFunction resource (placed before PortfolioApiFunction)

  LocalAiFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ../local_ai/harness/
      Handler: harness.app.lambda_handler
      Runtime: python3.12
      Architectures:
        - x86_64
      Timeout: 30
      Events:
        ChatPost:
          Type: Api
          Properties:
            Path: /chat
            Method: post
        ChatOptions:
          Type: Api
          Properties:
            Path: /chat
            Method: options
        ChatGet:
          Type: Api
          Properties:
            Path: /chat/{requestId}
            Method: get
        ChatGetOptions:
          Type: Api
          Properties:
            Path: /chat/{requestId}
            Method: options

# Outputs — added:
#   LocalAiFunction: !GetAtt LocalAiFunction.Arn
#   LocalAiFunctionIamRole: !GetAtt LocalAiFunctionRole.Arn
```

### Slice 5: Frontend Chat Component

**Files**: `frontend/src/App.tsx` (MODIFY), `frontend/src/App.test.tsx` (MODIFY), `frontend/src/styles.css` (MODIFY)

#### Automated Verification:
- [x] `"ai-chat"` added to `View` union type
- [x] New `NavButton` with label "AI Chat" and view "ai-chat"
- [x] Conditional render: `activeView === "ai-chat" && <AiChatView ... />`
- [x] `AiChatView` returns `<section className="view active">` root
- [x] Chat tab test: click nav button → verify chat messages render
- [x] Fetch mock intercepts `/chat` endpoint in test
- [x] Chat-specific CSS classes defined (chat-card, chat-bubble, chat-input, chat-send-btn)
- [x] TypeScript compiles without errors
- [x] vitest: 4/4 tests passing

#### Manual Verification:
- [x] Chat UI matches portfolio visual style (glass cards, section-header, tag styling)
- [x] Message bubbles visually distinguish user (dark, right-aligned) vs. assistant (light, left-aligned)
- [x] Input area has proper focus/active states
- [x] Responsive layout at 768px: vertical input area, full-width send button

```tsx
// frontend/src/App.tsx — added import
import { postChat, pollChat, type ChatResponse } from "./chatApi";

// frontend/src/App.tsx — View union extended
type View = "home" | "projects" | "resume" | "ai" | "ai-chat";

// frontend/src/App.tsx — new NavButton
<NavButton label="AI Chat" view="ai-chat" activeView={activeView} setActiveView={setActiveView} />

// frontend/src/App.tsx — conditional render
{activeView === "ai-chat" && <AiChatView profile={profile} />}

// frontend/src/App.tsx — AiChatView inline component
function AiChatView({ profile }: { profile: Profile }) {
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const response: ChatResponse = await postChat(trimmed);
      if (response.status === "DONE") {
        setMessages((prev) => [...prev, { role: "assistant", content: response.message }]);
      } else {
        let lastMessage = "";
        for await (const update of pollChat(response.requestId)) {
          lastMessage = update.message;
          if (update.status === "DONE") {
            setMessages((prev) => [...prev, { role: "assistant", content: lastMessage || "Processing complete." }]);
            break;
          }
          if (update.status === "FAILED") {
            setError(lastMessage || "Processing failed. Please try again.");
            break;
          }
        }
      }
    } catch {
      setError("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <section className="view active">
      <div className="chat-card">
        <div className="section-header">
          <h2>AI Chat</h2>
          <p>Ask about my skills, projects, certifications, or AWS architecture.</p>
        </div>
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>No messages yet. Send a message to start the conversation!</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              <strong>{msg.role === "user" ? "Me: " : "AI: "}</strong>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble assistant loading">
              <strong>AI: </strong>
              <span className="typing-indicator">Thinking…</span>
            </div>
          )}
        </div>
        {error && <div className="chat-error" role="alert">{error}</div>}
        <div className="chat-input-area">
          <textarea className="chat-input" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown} placeholder="Type a message…" disabled={loading} rows={2} />
          <button className="chat-send-btn" onClick={sendMessage} disabled={loading || !input.trim()} type="button">Send</button>
        </div>
      </div>
    </section>
  );
}
```

## Desired End State
### Frontend Usage
```tsx
// Nav button
<NavButton label="AI Chat" view="ai-chat" activeView={activeView} setActiveView={setActiveView} />

// Conditional render
{activeView === "ai-chat" && <AiChatView profile={profile} />}

// Chat API
import { postChat, pollChat, type ChatRequest, type ChatResponse } from './chatApi';

const response = await postChat("Tell me about your AWS experience");
// Returns: { requestId: "abc123", status: "PENDING", message: "...", sanitized: true }

for await (const update of pollChat(response.requestId)) {
  // update.status: "PENDING" | "DONE" | "FAILED"
}
```

### Backend Usage
```python
# Lambda handler
from harness.app import lambda_handler

# POST /chat body:
{"message": "Tell me about your AWS experience"}

# Response (camelCase):
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  },
  "body": "{\"requestId\": \"abc123\", \"status\": \"DONE\", \"message\": \"I have...\", \"sanitized\": true}"
}
```

### Harness Usage
```python
from harness.contracts import ChatRequest
from harness.mock_backend import MockModelBackend
from harness.safety import validate_safety
from harness.prompt_builder import load_context

# Build and execute
context = load_context()
backend = MockModelBackend()
validated = validate_safety(ChatRequest(message="Tell me about AWS"))
if validated:
    response = backend.generate(prompt)
    sanitized = validate_safety(response, for_output=True)
```

## File Map
| Path | Slice | Purpose | Status |
|------|-------|---------|--------|
| `local_ai/harness/harness/__init__.py` | 2 | Package init | ✅ Generated |
| `local_ai/harness/harness/contracts.py` | 1 | Pydantic models: ChatRequest, ChatResponse, ChatStatusResponse | ✅ Generated |
| `local_ai/harness/harness/mock_backend.py` | 2 | ModelBackend Protocol + MockModelBackend with keyword routing | ✅ Generated |
| `local_ai/harness/harness/safety.py` | 2 | Regex safety validation (input, output, context) | ✅ Generated |
| `local_ai/harness/harness/prompt_builder.py` | 2 | Sorted context file loading with lru_cache | ✅ Generated |
| `local_ai/harness/harness/app.py` | 3 | Lambda handler: route, harness call, snake→camel serialization | ✅ Generated |
| `local_ai/harness/tests/unit/test_handler.py` | 3 | Handler unit tests (8 tests) | ✅ Generated |
| `local_ai/harness/requirements.txt` | 2 | Python dependencies (pydantic) | ✅ Generated |
| `frontend/src/chatApi.ts` | 1 | Chat API client + types (postChat, pollChat) | ✅ Generated |
| `frontend/src/App.tsx` | 5 | View enum, NavButton, AiChatView inline component | ✅ Generated |
| `frontend/src/App.test.tsx` | 5 | Chat tab test (click, send, verify messages) | ✅ Generated |
| `frontend/src/styles.css` | 5 | Chat component CSS (bubbles, input, responsive) | ✅ Generated |
| `backend/template.yaml` | 4 | LocalAiFunction resource, routes, timeout 30s | ✅ Generated |
| `.gitignore` | MODIFY — Add local_ai secrets patterns |

## Ordering Constraints
1. **Slice 1 (Contracts + API Client)** must complete first — types used by all subsequent slices
2. **Slice 2 (Harness Core)** depends on Slice 1 — harness imports contract types
3. **Slice 3 (Lambda Handler)** depends on Slice 2 — handler imports harness modules
4. **Slice 4 (SAM Infrastructure)** depends on Slice 3 — template references Lambda handler entry point
5. **Slice 5 (Frontend Chat Component)** depends on Slice 1 (types from chatApi.ts) and Slice 4 (routes must exist for integration testing)
6. No parallel execution — each slice builds on the previous one

## Verification Notes
- **SAM deployment**: After template changes, run `sam validate --template backend/template.yaml` to catch syntax errors
- **Lambda local testing**: `sam local start-api` requires `local_ai/` directory with correct structure
- **CORS preflight**: The Lambda handler's `CORS_HEADERS` includes `POST` in `Allow-Methods: "GET,POST,OPTIONS"` — CORS preflight passes for POST
- **Test import paths**: Backend harness tests import `from harness import app` — follows the same inline pattern as existing backend tests
- **No `conftest.py` anywhere**: All fixtures live inline in test files — both harness and frontend tests follow this convention
- **vitest timer control**: `package.json:8` has vitest v4 with timer control — useful for testing polling loops with `vi.advanceTimersByTime()`
- **Frontend dev server**: `package.json:7` dev server binds to `127.0.0.1` — good for local testing
- **Test fix (sendByPlaceholder)**: vitest v4 / jsdom does not expose `screen.getByPlaceholder` — used `document.querySelector(".chat-messages")` and `document.querySelector("textarea.chat-input")` instead

## Performance Considerations
- **Lambda timeout**: 30s for mock backend (fast); leaves headroom for container model (Phase 2+)
- **Polling interval**: 2s default — balances responsiveness with API Gateway throttling (10 req/s per API)
- **Context file caching**: `lru_cache(maxsize=1)` — loaded once, reused for all requests in Lambda's lifetime
- **Response size**: Chat messages capped at reasonable length; no streaming (polling model)

## Migration Notes
- **None for Phase 1**: No data migration needed. New Lambda is a greenfield addition.
- **Backwards compatibility**: Existing `/health` and `/profile` routes are completely untouched.
- **API Gateway**: New routes share the same implicit API Gateway (`ServerlessRestApi`) created by SAM. No routing conflicts.
- **Environment config**: Dev frontend needs `VITE_API_BASE_URL` pointing to SAM local endpoint or deployed API.

## Pattern References
- `frontend/src/App.tsx:134-289` — View component patterns (HomeView, ProjectsView, ResumeView, AiRoadmapView)
- `frontend/src/App.tsx:100-113` — NavButton component pattern
- `frontend/src/App.tsx:54-109` — Conditional rendering pattern
- `frontend/src/App.test.tsx:22-37` — `vi.stubGlobal("fetch")` test pattern
- `frontend/src/App.test.tsx:43-51` — `userEvent` + `findByText` async assertion pattern
- `frontend/src/App.test.tsx:58-65` — Error state testing pattern
- `backend/hello_world/app.py:29-56` — Lambda handler + _response envelope
- `backend/tests/unit/test_handler.py:5-15` — `invoke()` + `body()` test helpers

## Developer Context
**Q (design checkpoint): Component location — inline in App.tsx or separate file?**
A: Inline in `App.tsx` — follows existing pattern where all views (HomeView, ProjectsView, ResumeView, AiRoadmapView) are defined in `App.tsx:134-289`. No new component files.

**Slice 1 approval**: Approved (Recommended) — Proceeded to code generation.
**Slice 2 approval**: Approved — Proceeded to code generation.
**Slice 3 approval**: Approved — Proceeded to code generation.
**Slice 4 approval**: Approved — SAM template updated, all existing backend tests pass.
**Slice 5 approval**: Approved — Frontend tests 4/4 pass, CSS and component complete.

## References
- `.rpiv/artifacts/research/2026-05-24_19-13-45_v2-local-ai-chatbot-harness.md` — Source research document
- `.rpiv/artifacts/designs/2026-05-24_19-59-24_v2-local-ai-chatbot-harness.md` — This design artifact
- `frontend/src/App.tsx` — Frontend view routing and component patterns
- `frontend/src/api.ts` — Existing API client (GET-only, no body support)
- `frontend/src/chatApi.ts` — Chat API client (POST + polling async generator)
- `frontend/src/App.test.tsx` — Frontend test patterns
- `local_ai/harness/harness/app.py` — Lambda handler for chat
- `local_ai/harness/tests/unit/test_handler.py` — Harness handler tests
- `backend/hello_world/app.py` — Existing Lambda handler and envelope
- `backend/template.yaml` — SAM template structure
- `backend/tests/unit/test_handler.py` — Existing backend test patterns

## Design History
- Slice 1: Contracts & API Client — approved as generated (fix: added `export` to `apiBaseUrl` in `api.ts:33` per slice-verifier finding)
- Slice 2: Harness Core — Mock Backend + Safety — approved, generated
- Slice 3: Lambda Handler — approved, generated (8/8 tests pass)
- Slice 4: SAM Infrastructure — approved, generated (existing 4/4 tests still pass)
- Slice 5: Frontend Chat Component — approved, generated (4/4 vitest tests pass)
