# 04 V2 Local AI Chatbot Harness Plan

## Goal

Build a visitor-facing AI chatbot for the portfolio without exposing the developer's normal local AI route.

The chatbot must use this path only:

```text
React UI
-> API Gateway
-> Lambda
-> SQS
-> MacBook polling agent
-> local_ai harness
-> isolated Docker model server
-> DynamoDB result
-> React polling
```

Hard security rule:

```text
Visitor input must never reach oMLX, pi, Hermes, shell automation, editor automation,
general local agents, arbitrary local files, AWS credentials, SSH keys, or the host home directory.
```

## Non-Negotiable Implementation Rules

These rules apply to every phase.

- Do not create, edit, or delete `.rpiv/` artifacts while implementing code fixes.
- Do not edit docs during code repair unless the task explicitly asks for docs.
- Do not implement later phases while repairing an earlier phase.
- Do not rename contract fields without updating frontend, backend, tests, and this plan.
- Do not use `FAILED`; use `ERROR`.
- Do not use `answer` in the Phase 1/Phase 2 harness response; use `message`.
- Do not call oMLX, pi, Hermes, shell commands, or personal local AI tools.
- Do not add Docker, SQS, DynamoDB, or AWS agent code before the phase that requires them.
- Every phase must pass its listed verification commands before continuing.

## Shared Chat Contract

Phase 1 and Phase 2 use the synchronous local harness contract.

`ChatRequest`:

```json
{
  "message": "What AWS services does this portfolio use?"
}
```

`ChatResponse`:

```json
{
  "requestId": "local_abcd1234",
  "status": "DONE",
  "message": "This portfolio uses S3, CloudFront, Route 53, API Gateway, and Lambda.",
  "sanitized": true
}
```

Allowed status values:

```text
PENDING
DONE
ERROR
```

Status rules:

- `DONE`: successful safe response.
- `ERROR`: rejected input, backend failure, timeout, invalid request, or unsafe unrecoverable output.
- `PENDING`: only for async AWS flow in Phase 3+.

Unsafe output rule:

```text
If output safety fails, never return the raw model output.
Replace it with a safe fallback message and set sanitized=false.
```

Required safe fallback:

```text
I cannot share that information. Please ask about my skills, projects, certifications, education, or AWS architecture.
```

## Target Repository Structure

Use this exact structure for Phase 1 and Phase 2:

```text
local_ai/
  harness/
    context/
      profile.md
      projects.md
    prompts/
      system_prompt.md
    harness/
      __init__.py
      app.py
      contracts.py
      mock_backend.py
      prompt_builder.py
      safety.py
      run_chat.py
      container_model_client.py        # Phase 2 only
    tests/
      unit/
        test_handler.py
        test_cli.py
        test_container_backend.py      # Phase 2 only
        test_docker_compose.py         # Phase 2 only
    requirements.txt
    docker-compose.yml                 # Phase 2 only
```

SAM uses:

```yaml
CodeUri: ../local_ai/harness/
Handler: harness.app.lambda_handler
```

Because of that, Python imports must work with:

```bash
PYTHONPATH=local_ai/harness python -m pytest local_ai/harness/tests/unit -q
```

## Phase 1: Repair And Complete Local Mock Harness

### Goal

Produce stable JSON locally using only the mock backend. No Docker. No AWS async flow. No SQS. No DynamoDB.

### Files To Create Or Modify

Required files:

```text
frontend/src/App.tsx
frontend/src/chatApi.ts
local_ai/harness/context/profile.md
local_ai/harness/context/projects.md
local_ai/harness/prompts/system_prompt.md
local_ai/harness/harness/app.py
local_ai/harness/harness/contracts.py
local_ai/harness/harness/mock_backend.py
local_ai/harness/harness/prompt_builder.py
local_ai/harness/harness/safety.py
local_ai/harness/harness/run_chat.py
local_ai/harness/tests/unit/test_handler.py
local_ai/harness/tests/unit/test_cli.py
local_ai/harness/requirements.txt
```

Forbidden in Phase 1:

```text
docker-compose.yml
container_model_client.py
requests
PyYAML
SQS
DynamoDB
MacBook polling agent
CloudFront/S3 changes
.rpiv changes
docs changes
```

### Phase 1 Required Behavior

Frontend:

- `View` may include `"ai-chat"` as a sibling view.
- `messages` state must be an array of message objects:

```ts
{ role: "user" | "assistant"; content: string }[]
```

- `ChatResponse.status` must be `"PENDING" | "DONE" | "ERROR"`.
- Comments and tests must not mention `FAILED`.
- `npm run build` must pass.

Lambda handler:

- `POST /chat` accepts `{ "message": string }`.
- Safe input returns HTTP 200 and `status: "DONE"`.
- Rejected input returns HTTP 400 with a safe message and `sanitized: false`.
- Unsafe generated output is replaced with the required fallback and `sanitized: false`.
- `GET /chat/{requestId}` may return `DONE` in Phase 1 because mock processing is synchronous.
- CORS must allow `GET,POST,OPTIONS`.

CLI harness:

- Must run with:

```bash
PYTHONPATH=local_ai/harness python -m harness.run_chat "What AWS services does this portfolio use?"
```

- Must print valid JSON only.
- Must include `requestId`, `status`, `message`, `sanitized`.
- Must use the same input safety, prompt builder, mock backend, and output safety rules as Lambda.
- Must never print unsafe raw model output.

Prompt builder:

- Load `local_ai/harness/prompts/system_prompt.md` first.
- Then load `local_ai/harness/context/profile.md`.
- Then load `local_ai/harness/context/projects.md`.
- Validate context files before including them.
- If a context file contains secrets, skip it or fail safely.

Safety:

- Reject empty input.
- Reject input longer than 2048 characters.
- Reject obvious prompt injection.
- Reject AWS key patterns.
- Reject requests to use oMLX, pi, Hermes, shell, local files, `.aws`, `.ssh`, `$HOME`, `/etc`, or `/home`.
- Reject output that leaks prompt text, claims local file/tool access, or contains credentials.

### Phase 1 Required Tests

`test_handler.py` must cover:

- Safe `POST /chat` returns HTTP 200, `DONE`, non-empty `message`, and `sanitized: true`.
- Empty message returns HTTP 400.
- Prompt injection returns HTTP 400.
- AWS credential pattern returns HTTP 400.
- Invalid JSON returns HTTP 400.
- Unsafe mock output is replaced by fallback and raw unsafe phrases are absent.
- Status enum contains `ERROR` and does not contain `FAILED`.
- `OPTIONS /chat` returns CORS headers.

`test_cli.py` must cover:

- Safe message returns valid JSON with `DONE`.
- Prompt injection returns valid JSON with `ERROR`.
- Credential pattern returns valid JSON with `ERROR`.
- No args returns valid JSON with `ERROR`.
- Unsafe mock output is replaced by fallback and raw unsafe phrases are absent.

### Phase 1 Verification

Run exactly:

```bash
cd frontend && npm run build
cd frontend && npm test -- --run
PYTHONPATH=local_ai/harness python -m pytest local_ai/harness/tests/unit -q
```

Phase 1 is not complete unless all three commands pass.

## Phase 2: Isolated Docker Model Client

### Goal

Use the same harness contract with an isolated local model server. Keep mock as the default backend.

### Files To Create Or Modify

```text
local_ai/harness/harness/container_model_client.py
local_ai/harness/harness/mock_backend.py
local_ai/harness/harness/__init__.py
local_ai/harness/docker-compose.yml
local_ai/harness/tests/unit/test_container_backend.py
local_ai/harness/tests/unit/test_docker_compose.py
local_ai/harness/requirements.txt
```

Allowed new dependencies in Phase 2:

```text
requests>=2.28
PyYAML>=6.0
```

### Phase 2 Required Behavior

Backend selection:

```text
LOCAL_AI_BACKEND=mock       # default
LOCAL_AI_BACKEND=container  # explicit opt-in only
```

Default container endpoint:

```text
CONTAINER_MODEL_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions
```

Container client:

- Use OpenAI-compatible Chat Completions API.
- POST to `/v1/chat/completions`.
- Send a `messages` array, not a raw completion prompt.
- Parse assistant-only response text.
- Timeout quickly.
- Raise structured internal errors on connection failure, timeout, invalid JSON, missing choices, or non-2xx status.
- Never call shell commands.
- Never call oMLX, pi, Hermes, or personal local AI routes.

Docker Compose:

- Bind only to `127.0.0.1:8080`.
- Do not bind `0.0.0.0`.
- Do not mount `$HOME`, `~/.aws`, `~/.ssh`, project root, or Docker socket.
- Do not use `privileged: true`.
- Mount model files read-only if a model mount is used.

### Phase 2 Required Tests

`test_container_backend.py` must cover:

- Successful chat completion parses assistant message.
- Timeout/connection failure returns controlled error.
- Non-2xx response returns controlled error.
- Invalid JSON returns controlled error.
- Missing assistant content returns controlled error.

`test_docker_compose.py` must cover:

- Port is localhost-only.
- No privileged mode.
- No Docker socket mount.
- No AWS credential mount.
- No SSH key mount.
- No home directory mount.

### Phase 2 Verification

Run:

```bash
PYTHONPATH=local_ai/harness python -m pytest local_ai/harness/tests/unit -q
LOCAL_AI_BACKEND=mock PYTHONPATH=local_ai/harness python -m harness.run_chat "What AWS services does this portfolio use?"
```

If Docker is available and model files are configured, also run:

```bash
LOCAL_AI_BACKEND=container PYTHONPATH=local_ai/harness python -m harness.run_chat "What AWS services does this portfolio use?"
```

Phase 2 is not complete if mock mode breaks.

## Phase 3: AWS Async Chat API

### Goal

Move public chat requests into an async AWS relay while preserving the same frontend-facing contract.

Required resources:

```text
SQS queue
DynamoDB table with TTL
Lambda POST /chat
Lambda GET /chat/{requestId}
IAM permissions scoped to only required queue/table actions
```

`POST /chat` must:

- Validate input.
- Create `requestId`.
- Store `PENDING` state.
- Send SQS message.
- Return `{ requestId, status: "PENDING" }`.

`GET /chat/{requestId}` must:

- Return `PENDING`, `DONE`, or `ERROR`.
- Return safe `message` only when available.
- Never expose internal errors or stack traces.

Phase 3 must not require inbound traffic to the MacBook.

## Phase 4: MacBook Polling Agent

### Goal

The MacBook agent processes SQS messages using outbound AWS calls only.

Required behavior:

- Long-poll SQS.
- Validate job payload.
- Call local harness model gateway.
- Write `DONE` or `ERROR` to DynamoDB.
- Delete SQS message only after DynamoDB write succeeds.
- Never call oMLX, pi, Hermes, shell automation, or arbitrary local files.
- Fail closed if the Docker model server is unavailable.

## Phase 5: Public Safety And Operations

Required before public use:

- Message length limit.
- Basic abuse/rate-limit strategy.
- DynamoDB TTL.
- CloudWatch logs.
- Timeout/offline UI state.
- Budget alarm.
- No secrets in git.
- Container isolation tests passing.
- Clear local runbook for starting/stopping the model container and agent.

## Overall Done Criteria

V2 is complete only when:

```text
1. Phase 1 mock harness passes all frontend and Python tests.
2. Phase 2 container backend works without breaking mock mode.
3. Phase 3 AWS API stores PENDING/DONE/ERROR state through SQS and DynamoDB.
4. Phase 4 MacBook agent processes requests with outbound AWS calls only.
5. Turning off the MacBook agent produces a clear timeout/offline UI state.
6. No secrets, account ids, resource ids, local paths, or private runtime details are committed.
7. Public chatbot traffic never uses oMLX, pi, Hermes, shell automation, or personal local AI routes.
8. Docker container isolation tests pass.
```

## Recommended Commit Sequence

```text
commit 1: repair Phase 1 mock harness contract and tests
commit 2: add Phase 2 container model client
commit 3: add Phase 2 docker compose validation
commit 4: add AWS async chat relay
commit 5: add MacBook polling agent
commit 6: add operational safety checks and runbook
```
