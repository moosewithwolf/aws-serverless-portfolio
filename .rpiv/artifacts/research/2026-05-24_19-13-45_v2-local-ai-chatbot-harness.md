---
date: "2026-05-24T19:13:45-0400"
author: Shinseong Kim
commit: 2798a53
branch: main
repository: aws-serverless-portfolio copy
topic: "V2 Local AI Chatbot Harness"
tags: [research, local-ai, chatbot, harness, prompt-injection, docker, lambda, sam]
status: complete
last_updated: "2026-05-24T19:13:45-0400"
last_updated_by: Shinseong Kim
last_updated_note: "Initial research for V2 local AI chatbot harness implementation"
---

# Research: V2 Local AI Chatbot Harness

## Research Question
Analyze the `aws-serverless-portfolio` codebase to answer implementation questions for the V2 Local AI Chatbot Harness — a visitor-facing chatbot that routes through AWS to an isolated Docker model container, with a Python harness for safety validation, prompt building, and mock/container model abstraction.

## Summary
The portfolio frontend uses a single-state `activeView` enum for tab-based routing with no router library. The backend is a monolithic SAM Lambda handler (`app.py`, ~60 lines) with implicit API Gateway routes. Testing uses vitest (frontend) and pytest (backend) with no `conftest.py` or `pyproject.toml`. The V2 harness requires:
- **Frontend:** Add `"ai-chat"` as a sibling `View` enum member, create `AiChatView` component, add `chatApi.ts` with `submitChat()` and `pollChat()` (async generator).
- **Backend:** Separate `LocalAiFunction` Lambda with `CodeUri: ../local_ai/harness/`, SAM routes for `POST /chat` and `GET /chat/{requestId}`, minimal IAM (CloudWatch implicit, DynamoDB Write if needed for Phase 1).
- **Harness:** Top-level `local_ai/` sibling to `backend/`, with modular subpackages. Critical: `snake_case`→`camelCase` JSON serialization for the API contract, and a `sanitized: bool` field in `ChatResponse`.
- **Security:** Regex-based safety validation (input + output), context file secret scanning, Docker compose validation tests. No CI/CD exists; Phase 5 will add rate limiting and operational safety.

## Detailed Findings

### Frontend — View Routing
- `frontend/src/App.tsx:6` defines `View = "home" | "projects" | "resume" | "ai"`. The least-invasive V2 change is adding `"ai-chat"` as a sibling (not splitting `"ai"` into `"ai-roadmap" | "ai-chat"`).
- Navigation uses `NavButton` (line 146) which accepts any `View` value — no component refactoring needed.
- Conditional rendering at `App.tsx:118-121` uses `activeView === "ai" && <AiRoadmapView />`. Add `activeView === "ai-chat" && <AiChatView />` after it.
- `App.tsx:44` — `useState<View>("home")` state declaration. No changes needed.
- `App.tsx:46-50` — Uses `Promise.all` for parallel fetch. The chat polling pattern requires a custom mechanism (async generator, not the existing `request<T>` pattern).

### Frontend — API Client
- `frontend/src/api.ts:33-36` — Generic `request<T>(path)` helper wraps `fetch()` with no method/body/headers. It only supports GET with no body.
- Chat operations (POST with body, GET polling) cannot use this helper directly. Create `frontend/src/chatApi.ts` as a dedicated module.
- `submitChat()` — POST `/chat` with `Content-Type: application/json`, body `JSON.stringify({ message })`.
- `pollChat()` — Async generator yielding `ChatStatusResponse` until terminal status (`DONE` or `FAILED`).
- `api.ts:24` — `apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ""`. Reuse this via import or duplicate.
- vitest supports `vi.advanceTimersByTime()` (package.json:8) — essential for testing polling loops.

### Frontend — Test Infrastructure
- `frontend/vite.config.ts:1-8` — vitest config with `environment: "jsdom"`, `globals: true`, `setupFiles: "./src/test/setup.ts"`.
- `frontend/src/test/setup.ts` — Imports `@testing-library/jest-dom/vitest`, mocks `window.scrollTo` (needed because `NavButton` calls `scrollTo`).
- `App.test.tsx` conventions: `beforeEach` + `vi.stubGlobal("fetch", ...)` for per-test mock, `render` + `screen` assertions, `userEvent.setup()` for interaction, `waitFor` for async assertions.
- New `AiChatView.test.tsx` should follow these conventions — mock fetch to simulate chat endpoints.

### Backend — Module Layout
- `backend/hello_world/app.py:3` — Tests import `from hello_world import app`, relying on SAM's `CodeUri`-based `sys.path` injection.
- No `pyproject.toml`, `conftest.py`, or project-level dependency management anywhere.
- `backend/tests/requirements.txt` (lines 1-3) has `pytest, boto3, requests`.
- **Recommendation:** `local_ai/` as top-level sibling to `backend/`. SAM's `CodeUri` for a function with `CodeUri: ../local_ai/harness/` adds `<root>/local_ai/` to `sys.path`, enabling natural imports like `from harness.chat_contract import ChatRequest`.
- Separate `local_ai/requirements.txt` for harness dependencies (openai, pydantic, etc.) — don't pollute `hello_world/requirements.txt`.

### Backend — SAM Template Changes
- `backend/template.yaml` — Current `PortfolioApiFunction` has 4 `Events` (Health, Profile, HealthOptions, ProfileOptions).
- New routes needed:
  ```yaml
  ChatPost:
    Type: Api
    Properties:
      Path: /chat
      Method: post
  ChatGet:
    Type: Api
    Properties:
      Path: /chat/{requestId}
      Method: get
  ChatPostOptions:
    Type: Api
    Properties:
      Path: /chat
      Method: options
  ChatGetOptions:
    Type: Api
    Properties:
      Path: /chat/{requestId}
      Method: options
  ```
- **Decision:** Separate `LocalAiFunction` Lambda (not extending existing `PortfolioApiFunction`). `CodeUri: ../local_ai/harness/`, `Handler: entry_point.lambda_handler`.
- `template.yaml:12` — Current timeout is 3 seconds. May need increasing for model calls (Phase 4+).
- CORS headers in `app.py:8` only list `GET,OPTIONS`. V2 Lambda's CORS needs `POST` appended.

### Backend — Minimal IAM for Phase 1
- CloudWatch Logs: Implicit via SAM `AWS::Serverless::Function` (`logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`).
- DynamoDB: If Phase 1 uses DDB for PENDING state, add `DynamoDBWritePolicy` SAM managed policy.
- SQS: Deferred to Phase 4 — no SQS permissions needed now.

### Harness — Contract Mapping (CRITICAL)
- **snake_case → camelCase mismatch:** Python `ChatRequest`/`ChatResponse` use snake_case (`request_id`, `requestId` in JSON). The Lambda wrapper must transform keys before `json.dumps()`.
  - Options: Use `pydantic` with `by_alias=True` and `Field(alias="requestId")`, or manually convert keys.
- **Status enum gap:** Plan says `status: "DONE" | "ERROR"` but POST `/chat` returns `"PENDING"`. The `ChatResponse` model must include `"PENDING"` as valid status.
- **API Gateway envelope:** Lambda returns `{"statusCode": 200, "headers": {...}, "body": json.dumps(payload)}`. The `body` is a JSON string, not a nested object.
- **Decided:** Add `sanitized: bool` field to `ChatResponse` for audit trails and downstream filtering.

### Harness — Safety Validation
- Input safety (pre-prompt):
  - Max length (2048 chars, Phase 5).
  - Empty input rejection.
  - Regex patterns for: credential exfiltration (`AKIA[0-9A-Z]{16}`), prompt injection (`ignore.*instructions`), tool-use (`oMLX`, `pi`, `Hermes`, `shell`), file access (`/etc`, `.ssh`, `.aws`, `$HOME`).
- Output safety (post-generation):
  - Detect prompt leakage (model echoes system prompt phrases).
  - Detect forbidden resource claims (model says it can access files/tools/credentials).
  - Enforce answer length bound (4096 chars, Phase 5).
- Context file scanning: Before prompt builder loads context files, `safety.py` should scan them for secret patterns (AWS keys, JWT tokens, private keys).

### Harness — Prompt Builder
- Use explicit sorted list of context files (`profile.md`, `projects.md`, `resume.md`) — NOT raw `glob` which could pick up unknown files.
- Lazy loading with `@functools.lru_cache(maxsize=1)` — loaded on first call, cached for reuse.
- Path resolution: `_ROOT = Path(__file__).parent.parent` (relative to module, not CWD).
- Deterministic order: `sorted([...], key=lambda p: p.name)` guarantees alphabetical ordering.

### Harness — Mock Model
- Keyword-based routing with priority-ordered checks (security-sensitive patterns first: injection → tool-use → credential → content).
- Routes: `aws_architecture`, `certifications`, `projects`, `skills`, `education`, `prompt_injection`, `tool_runtime`, `credential_request`, `private_info`, `unavailable`.
- `ModelBackend` Protocol (typing) for abstraction: both `MockModelBackend` and `ContainerModelBackend` implement `generate(prompt: str) -> str`.
- `LOCAL_AI_BACKEND` env var dispatches to mock (default) or container backend.
- `container_model_client.py` uses `requests.post()` with `timeout=15.0` — exceptions convert to `ERROR` status, no hangs.

### Security — Current Posture
- `backend/hello_world/app.py:7-11`: CORS `Access-Control-Allow-Origin: *` — fully open, no auth.
- `.gitignore:138-140`: Excludes `.env`, `.envrc`, `.venv`, `personal/`.
- `.github/` does not exist — no CI/CD, no linting, no pre-commit hooks.
- `infra/frontend-hosting.yaml:25-35`: S3 hardened (BlockPublicAcls, CloudFront sigv4, HTTPS redirect) — but Lambda backend is separate and unprotected.
- `frontend/package.json:8`: Vite dev server binds to `127.0.0.1` — good, not `0.0.0.0`.

### Security — Phase 1 Additions
- `safety.py` validates context files for secrets before prompt building (AWS key patterns, JWT, private key headers, API keys).
- Harness output includes `sanitized: bool` flag.
- Docker compose validation test (Phase 2, designed in Phase 1): asserts `privileged: false`, no `~/.aws`/`~/.ssh` mounts, `127.0.0.1` port binding only, no Docker socket.
- `.gitignore` should add `local_ai/**/secrets` or similar pattern.

## Code References
- `frontend/src/App.tsx:6` — `View` type definition (union of 4 literals, add `"ai-chat"`)
- `frontend/src/App.tsx:44` — `useState<View>("home")` state
- `frontend/src/App.tsx:106-110` — NavButton instances (add new one)
- `frontend/src/App.tsx:118-121` — Conditional view rendering (add `ai-chat` branch)
- `frontend/src/api.ts:33-36` — Generic `request<T>` helper (GET-only, no body support)
- `frontend/src/test/setup.ts:1-4` — Global test setup, `window.scrollTo` mock
- `frontend/package.json:8` — vitest v4 with timer control
- `backend/hello_world/app.py:26` — `lambda_handler` entrypoint
- `backend/hello_world/app.py:44-54` — `_response()` envelope builder
- `backend/hello_world/app.py:8` — CORS headers (needs POST added)
- `backend/template.yaml:14-17` — `PortfolioApiFunction` function definition
- `backend/template.yaml:18-44` — Events block (add 4 new events)
- `backend/template.yaml:12` — Timeout 3s (may need increase)
- `backend/tests/unit/test_handler.py:5-14` — `invoke()` helper pattern for test imports

## Integration Points

### Inbound References
- `frontend/src/App.tsx:46-50` — Fetches `/health` and `/profile` in parallel via `Promise.all`
- `frontend/src/api.ts:24` — `VITE_API_BASE_URL` env var determines API base URL
- `backend/hello_world/app.py:26-42` — Lambda handler parses `rawPath`/`httpMethod` from event dict
- `backend/hello_world/app.py:44-54` — `_response()` wraps payload in API Gateway envelope

### Outbound Dependencies
- `backend/hello_world/app.py:1` — Imports `json` for serialization
- `backend/hello_world/app.py:8-11` — Hardcoded `CORS_HEADERS` dict
- `frontend/package.json` — Dependencies: react, react-dom, vite, typescript, vitest, testing-library
- `backend/hello_world/requirements.txt` — `requests` (future: add harness deps)

### Infrastructure Wiring
- `backend/template.yaml:18-44` — SAM `Events` block defines API Gateway routes
- `backend/template.yaml:47-53` — Outputs: `PortfolioApiBaseUrl`, function ARN, IAM role ARN
- `.gitignore:138-140` — Excludes `.env`, `.envrc`, `.venv`
- `.github/` — Empty/nonexistent; no CI/CD pipeline exists

## Architecture Insights
1. **Single-state view routing:** The entire frontend uses one `activeView` state variable. No React Router — views are conditionally rendered with `&&` short-circuit. New views simply add a `View` literal and conditional render branch.
2. **Monolithic Lambda handler:** `app.py` uses `if/elif` chains for routing. V2 should either extend this pattern or create a separate Lambda with its own handler.
3. **No dependency management tools:** No `pyproject.toml`, no `package.json` workspaces. Each subproject manages dependencies independently.
4. **Implicit SAM resources:** SAM's `AWS::Serverless::Function` auto-creates API Gateway, IAM roles, and log groups. No explicit resource definitions needed for the API surface.
5. **Test patterns:** Frontend uses `vi.stubGlobal` for fetch mocking; backend uses `invoke()` helper for handler-level testing. Both avoid conftest.py.
6. **CORS fully open:** `Access-Control-Allow-Origin: *` with no auth. Phase 5 will add rate limiting and tightening.
7. **No secrets in git:** `.gitignore` excludes `.env` and `.venv`, but no pre-commit hooks or CI scanning exist.

## Precedents & Lessons

### Precedent: Initial Frontend Implementation
**Commit(s)**: `02f3017` — "feat: add React portfolio frontend" (2026-05-somewhere)
**Blast radius**: 3 files (`App.tsx`, `api.ts`, plus test/setup files)
- `frontend/src/App.tsx` — 250+ line single-file component
- `frontend/src/api.ts` — thin HTTP client

### Precedent: Initial Backend Implementation
**Commit(s)**: `5483a07` — "feat: add portfolio serverless API"
**Blast radius**: 2 files (`app.py`, `template.yaml`)
- Monolithic Lambda handler with inline routing

### Precedent: SAM Foundation
**Commit(s)**: `8a1513a` — "feat: add SAM init setup"
**Blast radius**: 2 files (same as above, initial creation)

**Lessons from commits:**
- All key files were initial adds — no follow-up fixes, no regression patches found in git history.
- The project has grown linearly without architectural refactoring, so adding new components without breaking existing patterns is important.

**Takeaway:** No historical failure patterns to avoid. The main risk is adding complexity to the monolithic patterns without clear separation.

### Composite Lessons
- **Incremental addition works:** Each phase adds files without refactoring existing ones (View addition, Lambda extension, new routes).
- **Monolithic handlers scale poorly:** `app.py` is already 60 lines with 2 routes; adding `/chat` routes with POST support would push it toward 100+ lines. Separate Lambda is cleaner.
- **No conftest.py anywhere:** All fixtures live in test files. Follow this convention for `local_ai/tests/`.

## Historical Context (from `.rpiv/artifacts/`)
- No prior `.rpiv/artifacts/` documents exist in this repository.

## Developer Context
**Q (discover: unknown): SAM Lambda routing — separate function or extend existing?**
A: Separate `LocalAiFunction` Lambda with `CodeUri: ../local_ai/harness/`. Preserves import isolation and keeps existing `app.py` untouched.

**Q (discover: unknown): Package layout — top-level or nested?**
A: Top-level sibling `local_ai/` to `backend/`. SAM's `CodeUri` resolution works cleanly; separate `requirements.txt` avoids dependency conflicts.

**Q (discover: unknown): Frontend navigation — split or add sibling enum?**
A: Add `"ai-chat"` as sibling to existing `View` type. Zero deletions, `NavButton` already accepts any `View`.

**Q (discover: unknown): Contract extension — add sanitized field?**
A: Yes, add `sanitized: bool` to `ChatResponse` for audit trails and downstream filtering.

## Related Research
- None (no prior research documents exist in this project).

## Open Questions
1. **Target model for Docker container:** llama.cpp Q4_K_M 3B? Larger/smaller? Any preference from developer?
2. **Lambda timeout for Phase 4:** 3 seconds is current default. Should it be increased for model calls (e.g., 30-60s)?
3. **Rate limiting approach:** API Gateway usage plans, Lambda throttling, or application-level in Phase 5?
4. **CloudWatch log retention:** Default is infinite. Should it be set to 30/90/365 days for cost control?
5. **DynamoDB TTL:** Phase 4 should include `TTL` attribute on `ChatRequestsTable` for automatic cleanup of old requests.
6. **GitHub Actions CI:** Should a basic CI pipeline be added in Phase 5 to run `pytest` and `npm test` on PRs?
