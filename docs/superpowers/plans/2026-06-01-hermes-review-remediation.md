# Hermes-Guided Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current experimental portfolio/chatbot codebase into a reproducible, IaC-led, tested structure while using one persistent local Hermes worker for implementation and Codex for strict review, testing, and reassignment.

**Architecture:** Codex is the controller and verifier. Hermes is a single persistent terminal-based worker that receives one bounded task at a time, edits only the allowed files, reports changed files/tests, and waits. Each task ends with Codex diff review, targeted tests, and either reassignment or progression to the next task.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, AWS SAM/CloudFormation, Lambda Python 3.12, DynamoDB, SQS, pytest, separate local Hermes terminal worker.

---

## Operating Protocol

### Workspace, Branch, Commit, And PR Ownership

Codex owns all git and workspace operations. Hermes must never create branches, switch branches, stage files, commit, push, create pull requests, merge, rebase, or resolve git conflicts unless Codex gives a narrow command-level instruction.

Execution begins with Codex setting up the work area:

1. Detect whether the current checkout is already an isolated worktree:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
git rev-parse --show-superproject-working-tree 2>/dev/null
git branch --show-current
```

2. If this is the normal project checkout, Codex creates an isolated worktree/branch before implementation. Preferred branch name:

```text
codex/review-remediation-hermes
```

3. Codex updates/verifies the branch base if needed, checks the starting tree, and runs baseline tests before Hermes edits anything.

4. Codex creates commits only after reviewing Hermes' diff and running the relevant tests. Hermes only reports patch status.

5. Codex pushes the branch and opens the pull request only after final verification passes. PR creation is not delegated to Hermes.

Before each Hermes assignment, Codex states the active branch/worktree path in the prompt so Hermes knows exactly where it is operating.

### Controller/Worker Roles

- Codex owns planning, task assignment, diff review, test execution, and final acceptance.
- Hermes owns implementation only inside the explicitly assigned file set.
- Hermes must not run `git add`, `git commit`, `git push`, or PR commands.
- Hermes must not modify `.env.local-ai`, `.agent/`, model files, generated build output, AWS console state, or unrelated docs.
- Hermes must stop after each task and report: changed files, tests run, test output summary, unresolved questions.

### Hermes Session Budget And Rotation

Hermes has a large context window, approximately 220k tokens, but Codex should still keep prompts compact and rotate sessions intentionally.

Use one persistent Hermes session while the tasks are related and the accumulated context remains useful.

Start a fresh Hermes session when any of these are true:

- Moving between independent domains, for example backend/SQS hardening to frontend navigation.
- A task can be completed from the plan and current files without needing prior Hermes conversation.
- The Hermes session has accumulated roughly 140k-170k tokens of context.
- Hermes starts referencing stale instructions, mixing tasks, or editing outside allowed files.
- A task fails twice for reasons that look like context confusion rather than code complexity.

When starting a fresh Hermes session, Codex gives a compact handoff prompt:

```text
You are a fresh Hermes implementation worker for this repository.

Current branch/worktree:
<absolute path and branch>

You only need the current task below. Do not rely on earlier conversation.
Read the named files yourself.
Edit only allowed files.
Do not run git add, git commit, git push, or PR commands.
Stop after the task and report changed files/tests.

Task:
<single task prompt>
```

Do not preserve unnecessary chat history by pasting previous full outputs. Paste only the verified state and the current task.

### Persistent Hermes Session

Codex should start and keep one terminal session open for the separate development Hermes worker so context accumulates across tasks.

Important boundary:

- `scripts/start-agent.sh` and `scripts/stop-agent.sh` are for the public website chatbot path only.
- `local_ai/harness/harness/run_chat.py` is also for the portfolio chatbot harness only.
- Do not use the website chatbot model/server as the coding worker for this remediation.
- The coding worker must be a separate Hermes/local-agent CLI or terminal process intended for development tasks.

Run discovery first:

```bash
command -v hermes || true
command -v ollama || true
command -v mlx_lm || true
find "$HOME" -maxdepth 3 \( -iname '*hermes*' -o -iname '*skills*' \) 2>/dev/null | sed -n '1,120p'
```

If a `hermes` CLI exists, inspect it:

```bash
hermes --help
hermes skills --help || true
hermes skills list || true
```

If Hermes is exposed through another local CLI, inspect that CLI's help and identify the command that supports a persistent interactive session. Do not send codebase secrets or `.env` contents to the model.

Start the persistent worker only after discovery:

```bash
mkdir -p .agent/hermes-work
```

Preferred session shape:

```bash
cd /Users/shinseong/SCHOOL/personal/aws-serverless-portfolio
hermes
```

If no separate development Hermes CLI/terminal process is available, stop and ask the user how Hermes should be launched. Do not fall back to the portfolio chatbot harness.

Codex must keep the Hermes development terminal session alive and interact with it task-by-task rather than sending one giant prompt.

### Hermes Skill Exploration Prompt

Send this before any implementation task:

```text
You are the implementation worker for this repository.

First, explore your available Hermes/local-agent skills.
Do not edit files.
Report:
1. available skills/tools you can use,
2. which skills are relevant for TypeScript/React work,
3. which skills are relevant for Python/AWS/SAM work,
4. any limitations that affect code editing or test running.

Do not infer missing tools. If a skill is not actually available, say unavailable.
Stop after the report.
```

Codex acceptance for this step:

- The report names concrete available skills/tools.
- The report does not claim access to unavailable tools.
- No repository files changed.

---

## File Structure Targets

### Backend/IaC

- Modify: `backend/template.yaml`
  - SQS DLQ and RedrivePolicy.
  - Queue/table names derived from stack name or parameters.
  - Retention/TTL alignment.
  - IAM updates only if compensation cleanup needs delete/update permissions.
- Modify: `local_ai/harness/harness/app.py`
  - Preserve stored `sanitized` value.
  - Validate `requestId` format before DynamoDB lookup.
  - Add compensation path when SQS enqueue fails after DynamoDB write.
  - Remove dead imports/functions only after behavior fixes are tested.
- Modify: `local_ai/harness/harness/sqs_agent.py`
  - Treat known stale jobs and malformed jobs deliberately.
  - Avoid infinite retry for unrecoverable payloads when DLQ exists.
- Modify: `local_ai/harness/tests/unit/test_handler.py`
  - Handler tests for `sanitized`, request ID validation, enqueue compensation.
- Modify: `local_ai/harness/tests/unit/test_sqs_agent.py`
  - Agent tests for stale/malformed payload behavior.
- Modify/Create: template validation tests under `local_ai/harness/tests/unit/` or `backend/tests/unit/`
  - Check DLQ, RedrivePolicy, non-hardcoded names, retention/TTL relationship.

### Frontend

- Modify: `frontend/src/App.tsx`
  - Centralize hash navigation.
  - Fix Back/Forward behavior.
  - Fix Home `Explore Work` hash update.
  - Add `aria-current` or equivalent nav state.
- Modify: `frontend/src/App.test.tsx`
  - Routing tests for hash navigation, Back/Forward, Explore Work.
- Modify: `frontend/src/chatApi.ts`
  - Add runtime response validation.
  - Add optional AbortSignal support to `postChat` and `pollChat`.
- Modify: `frontend/src/ChatConversation.tsx`
  - Abort in-flight chat request/poll on unmount.
  - Avoid state updates after unmount.
- Modify: `frontend/src/chatApi.test.ts`
  - Invalid JSON shape tests.
  - Abort/cancel tests.
- Optional later split:
  - Create: `frontend/src/portfolioData.ts`
  - Create: `frontend/src/navigation.ts`
  - Only do this after behavior fixes pass.

---

## Task 0: Baseline And Drift Inventory

**Files:**
- Read: `backend/template.yaml`
- Read: `.env.local-ai.example`
- Read: `scripts/start-agent.sh`
- Read: `scripts/stop-agent.sh`
- No edits.

Note: `scripts/start-agent.sh` and `scripts/stop-agent.sh` are inspected only because they describe how the website chatbot is started/stopped and which AWS variables it depends on. They are not used to launch the coding worker.

- [x] **Step 1: Ask Hermes for repository-only inventory**

Prompt:

```text
Task 0A: Repository inventory only. Do not edit files.

Read these files:
- backend/template.yaml
- scripts/start-agent.sh
- scripts/stop-agent.sh
- .env.local-ai.example
- local_ai/harness/harness/app.py
- local_ai/harness/harness/sqs_agent.py

Report the current repo-defined values for:
- ChatQueue MessageRetentionPeriod
- ChatQueue VisibilityTimeout
- whether ChatQueue has RedrivePolicy
- whether a DLQ resource exists
- ChatRequestTable table name source
- ChatQueue queue name source
- CHAT_TTL_SECONDS value
- whether start/stop scripts rely on env values from .env.local-ai

Do not propose fixes yet. Stop after the inventory.
```

- [x] **Step 2: Codex verifies no edits and baseline**

Run:

```bash
git status --short
cd frontend && npm test
cd frontend && npm run build
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit -q
cd backend && ../.venv/bin/python -m pytest tests/unit -q
```

Expected: no new changes from Hermes and all baseline tests pass before implementation begins.

- [ ] **Step 3: Optional AWS console drift check by Codex**

Only if `.env.local-ai` exists and the user approves using configured AWS profile:

```bash
set -a && source .env.local-ai && set +a
aws sqs get-queue-attributes \
  --queue-url "$CHAT_QUEUE_URL" \
  --attribute-names All \
  --profile "${AWS_PROFILE:-portfolio}" \
  --region "${AWS_REGION:-ca-central-1}"
```

Expected: actual console attributes can be compared against `backend/template.yaml`.

Codex records drift as notes before editing IaC.

---

## Task 1: Backend Contract Fixes

**Files:**
- Modify: `local_ai/harness/harness/app.py`
- Modify: `local_ai/harness/tests/unit/test_handler.py`

- [x] **Step 1: Assign only the sanitized/requestId tests**

Prompt:

```text
Task 1A: Write failing backend handler tests only.

Allowed files:
- local_ai/harness/tests/unit/test_handler.py

Add tests for:
1. GET /chat/{requestId} returns sanitized=false when DynamoDB item has status DONE and sanitized false.
2. GET /chat/{requestId} returns 400 for malformed request IDs such as "bad", "chat_", and a 500-character string.

Do not edit production code.
Run:
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_handler.py -q

Expected result: new tests fail.
Stop and report changed files and exact failing test names.
```

- [x] **Step 2: Codex confirms failure**

Run:

```bash
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_handler.py -q
```

Expected: fails for the two new behaviors.

- [x] **Step 3: Assign minimal implementation**

Prompt:

```text
Task 1B: Implement only the failing handler behavior.

Allowed files:
- local_ai/harness/harness/app.py

Required implementation:
1. Add request ID validation using exactly this accepted shape: chat_ followed by 32 lowercase hex characters.
2. In lambda_handler before _handle_chat_get, reject malformed IDs with statusCode 400 and body {"message": "Invalid requestId"}.
3. In DONE response, set sanitized from item.get("sanitized", False), not a hardcoded true.
4. Do not change POST behavior yet.
5. Do not perform unrelated cleanup.

Run:
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_handler.py -q

Expected result: pass.
Stop and report changed files and test result.
```

- [x] **Step 4: Codex verifies**

Run:

```bash
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_handler.py -q
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit -q
```

Expected: all local AI unit tests pass.

---

## Task 2: SQS/DynamoDB Operational Hardening

**Files:**
- Modify: `backend/template.yaml`
- Modify: `local_ai/harness/harness/app.py`
- Modify: `local_ai/harness/harness/sqs_agent.py`
- Modify: `local_ai/harness/tests/unit/test_handler.py`
- Modify: `local_ai/harness/tests/unit/test_sqs_agent.py`
- Modify/Create: infrastructure template tests.

- [x] **Step 1: Assign failing infrastructure tests**

Prompt:

```text
Task 2A: Write failing infrastructure tests only.

Allowed files:
- local_ai/harness/tests/unit/test_docker_compose.py only if extending existing YAML parsing helpers makes sense
- otherwise create local_ai/harness/tests/unit/test_sam_template.py

Read backend/template.yaml as YAML.
Add tests that assert:
1. ChatQueue has RedrivePolicy.
2. A DLQ resource exists for chat jobs.
3. ChatQueue MessageRetentionPeriod is not longer than CHAT_TTL_SECONDS unless the agent has stale-job handling documented in code.
4. ChatRequestTable TableName and ChatQueue QueueName are not fixed global names "chat-requests" and "chat-jobs".

Do not edit backend/template.yaml.
Run:
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_sam_template.py -q

Expected result: tests fail.
Stop and report changed files and failing assertions.
```

- [x] **Step 2: Assign SAM template update**

Prompt:

```text
Task 2B: Update SAM template to satisfy infrastructure tests.

Allowed files:
- backend/template.yaml

Required changes:
1. Add ChatDeadLetterQueue as AWS::SQS::Queue.
2. Add RedrivePolicy to ChatQueue with maxReceiveCount: 3 and deadLetterTargetArn referencing ChatDeadLetterQueue.Arn.
3. Change ChatRequestTable TableName to !Sub "${AWS::StackName}-chat-requests".
4. Change ChatQueue QueueName to !Sub "${AWS::StackName}-chat-jobs".
5. Change dead-letter queue name to !Sub "${AWS::StackName}-chat-jobs-dlq".
6. Align MessageRetentionPeriod with CHAT_TTL_SECONDS=3600 by setting MessageRetentionPeriod: 3600, unless you also implement stale-job handling in this same task. Prefer retention alignment for this task.
7. Do not change API routes or Lambda handlers.

Run:
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_sam_template.py -q

Expected result: pass.
Stop and report changed files and test result.
```

- [x] **Step 3: Assign POST compensation tests**

Prompt:

```text
Task 2C: Write failing tests for POST enqueue compensation.

Allowed files:
- local_ai/harness/tests/unit/test_handler.py

Add a test where:
1. CHATBOT_ENABLED=true.
2. DynamoDB put_item succeeds.
3. SQS send_message fails.
4. Handler returns 503.
5. The stored request is not left as PENDING; assert either delete_item is called or update_item writes status ERROR.

Use the existing test doubles in test_handler.py if present.
Do not edit production code.

Run:
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_handler.py -q

Expected result: new test fails.
Stop and report changed files and failing test.
```

- [x] **Step 4: Assign POST compensation implementation**

Prompt:

```text
Task 2D: Implement enqueue failure compensation.

Allowed files:
- local_ai/harness/harness/app.py
- backend/template.yaml only if IAM permission is needed

Required behavior:
If _store_pending_request succeeds but _send_chat_job fails:
1. Mark the item ERROR with message "Service unavailable. Please try again later." and sanitized false, or delete the item.
2. Prefer ERROR update because it preserves observability.
3. Add the minimal DynamoDB UpdateItem permission in backend/template.yaml if the Lambda policy does not allow it.
4. Preserve the existing 503 API response shape.
5. Do not change SQS agent behavior in this task.

Run:
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit/test_handler.py -q

Expected result: pass.
Stop and report changed files and test result.
```

- [x] **Step 5: Codex verifies backend**

Run:

```bash
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit -q
cd backend && ../.venv/bin/python -m pytest tests/unit -q
```

Expected: all pass.

---

## Task 3: Frontend Navigation Correctness

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [x] **Step 1: Assign failing tests**

Prompt:

```text
Task 3A: Write failing frontend navigation tests only.

Allowed files:
- frontend/src/App.test.tsx

Add tests for:
1. Clicking "Explore Work" changes visible view to Projects and updates window.location.hash to "#projects".
2. Clicking nav buttons updates the hash.
3. Browser Back/Forward via popstate updates the active view to match the URL hash.

Do not edit App.tsx.
Run:
cd frontend && npm test -- App.test.tsx

Expected result: at least one new test fails.
Stop and report changed files and failing test names.
```

- [x] **Step 2: Assign navigation implementation**

Prompt:

```text
Task 3B: Implement navigation fixes only.

Allowed files:
- frontend/src/App.tsx

Required behavior:
1. Create one internal function that changes both activeView and URL hash.
2. Use that function for nav buttons and Home "Explore Work".
3. Listen for both hashchange and popstate, or use one reliable event strategy that makes Back/Forward update activeView.
4. Keep the current hash format: home => no hash, projects => #projects, resume => #resume, ai-chat => #ai-chat.
5. Do not refactor portfolio data in this task.

Run:
cd frontend && npm test -- App.test.tsx

Expected result: pass.
Stop and report changed files and test result.
```

- [x] **Step 3: Codex verifies frontend routing**

Run:

```bash
cd frontend && npm test -- App.test.tsx
cd frontend && npm test
cd frontend && npm run build
```

Expected: all pass.

---

## Task 4: Frontend Chat Runtime Safety

**Files:**
- Modify: `frontend/src/chatApi.ts`
- Modify: `frontend/src/chatApi.test.ts`
- Modify: `frontend/src/ChatConversation.tsx`
- Modify: `frontend/src/GlobalChatWidget.test.tsx`

- [x] **Step 1: Assign failing API validation tests**

Prompt:

```text
Task 4A: Write failing chat API validation tests only.

Allowed files:
- frontend/src/chatApi.test.ts

Add tests that:
1. postChat rejects if response JSON lacks requestId for PENDING.
2. postChat rejects if status is not PENDING, DONE, or ERROR.
3. pollChat rejects if a poll response has an invalid status.
4. pollChat accepts DONE with a string message.

Do not edit chatApi.ts.
Run:
cd frontend && npm test -- chatApi.test.ts

Expected result: new invalid-shape tests fail.
Stop and report changed files and failing test names.
```

- [x] **Step 2: Assign API validation implementation**

Prompt:

```text
Task 4B: Implement chat API runtime validation.

Allowed files:
- frontend/src/chatApi.ts

Required behavior:
1. Add a small local type guard for statuses: PENDING, DONE, ERROR.
2. Validate postChat JSON before returning it.
3. Validate pollChat JSON before yielding it.
4. Throw Error with messages beginning "Invalid chat response" or "Invalid chat status response".
5. Do not add a schema library.

Run:
cd frontend && npm test -- chatApi.test.ts

Expected result: pass.
Stop and report changed files and test result.
```

- [x] **Step 3: Assign abort support tests**

Prompt:

```text
Task 4C: Write failing abort tests only.

Allowed files:
- frontend/src/chatApi.test.ts
- frontend/src/GlobalChatWidget.test.tsx if needed

Add tests that:
1. postChat passes AbortSignal to fetch.
2. pollChat stops when AbortSignal is aborted.
3. A chat component unmount during loading does not set visible error after unmount.

Do not edit production code.
Run:
cd frontend && npm test -- chatApi.test.ts GlobalChatWidget.test.tsx

Expected result: at least one new test fails.
Stop and report changed files and failing test names.
```

- [x] **Step 4: Assign abort implementation**

Prompt:

```text
Task 4D: Implement abort support.

Allowed files:
- frontend/src/chatApi.ts
- frontend/src/ChatConversation.tsx

Required behavior:
1. postChat accepts optional AbortSignal and passes it to fetch.
2. pollChat accepts optional AbortSignal, passes it to fetch, and stops before waiting if aborted.
3. useChatSession creates an AbortController per sendMessage call.
4. useChatSession aborts any in-flight request on unmount.
5. If abort happens, do not show "Failed to send message" to the user.
6. Do not change UI styling in this task.

Run:
cd frontend && npm test -- chatApi.test.ts GlobalChatWidget.test.tsx

Expected result: pass.
Stop and report changed files and test result.
```

- [x] **Step 5: Codex verifies frontend chat**

Run:

```bash
cd frontend && npm test
cd frontend && npm run build
```

Expected: all pass.

---

## Task 5: Structure Cleanup After Behavior Is Safe

**Files:**
- Modify/Create frontend files only after Tasks 3 and 4 pass.
- Modify backend dead code only after Tasks 1 and 2 pass.

- [x] **Step 1: Assign frontend data extraction**

Prompt:

```text
Task 5A: Extract frontend static portfolio data without changing behavior.

Allowed files:
- frontend/src/App.tsx
- create frontend/src/portfolioData.ts

Move these from App.tsx to portfolioData.ts:
- localModelName
- awsCertifications
- projectLinks
- fallbackProfile

Export them with the same names.
Do not change rendered text.
Do not change tests unless imports require updates.

Run:
cd frontend && npm test
cd frontend && npm run build

Expected result: pass.
Stop and report changed files and test result.
```

- [ ] **Step 2: Assign backend dead-code cleanup**

Prompt:

```text
Task 5B: Remove dead backend handler code only.

Allowed files:
- local_ai/harness/harness/app.py

Remove unused imports and functions that are not referenced by tests or runtime:
- unused ChatResponse import if unused
- unused ChatStatusResponse import if unused
- unused load_context import if unused
- unused validate_output import if unused
- _build_prompt if unused
- _model_to_dict if unused

Do not change behavior.

Run:
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit -q

Expected result: pass.
Stop and report changed files and test result.
```

- [ ] **Step 3: Codex verifies cleanup**

Run:

```bash
cd frontend && npm test && npm run build
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit -q
cd backend && ../.venv/bin/python -m pytest tests/unit -q
git diff --check
```

Expected: all pass and no whitespace errors.

---

## Task 6: Final Review And Optional Manual AWS Reconciliation

**Files:**
- Modify docs only if actual console drift was confirmed.

- [ ] **Step 1: Codex final local verification**

Run:

```bash
git status --short
cd frontend && npm test
cd frontend && npm run build
PYTHONPATH=local_ai/harness python3 -m pytest local_ai/harness/tests/unit -q
cd backend && ../.venv/bin/python -m pytest tests/unit -q
git diff --check
```

Expected: all tests pass.

- [ ] **Step 2: Codex SAM validation if SAM CLI is available**

Run:

```bash
cd backend && sam validate
```

Expected: template valid. If `sam` is unavailable, record that validation was not run.

- [ ] **Step 3: Optional AWS drift reconciliation**

Only with user approval:

```bash
set -a && source .env.local-ai && set +a
aws sqs get-queue-attributes \
  --queue-url "$CHAT_QUEUE_URL" \
  --attribute-names All \
  --profile "${AWS_PROFILE:-portfolio}" \
  --region "${AWS_REGION:-ca-central-1}"
```

Codex compares console state to `backend/template.yaml` and reports any mismatch. Do not change AWS console manually unless the user explicitly asks.

- [ ] **Step 4: Codex commits, pushes, and creates PR**

Only after all required tests and diff checks pass, Codex reviews the final diff:

```bash
git status --short
git diff --stat
git diff --check
git branch --show-current
```

Then Codex stages and commits verified changes:

```bash
git add <verified files only>
git commit -m "fix: harden portfolio chat architecture"
```

Codex pushes the branch and creates the PR using available project tooling. Hermes must not perform this step.

PR body must include:

- Summary of backend/IaC changes.
- Summary of frontend changes.
- Test commands run and pass/fail result.
- Any AWS console drift observed but not changed.
- Explicit note that website chatbot `scripts/start-agent.sh`/`stop-agent.sh` were not used as the coding worker.

---

## Reassignment Rules

If Hermes returns a patch that fails tests:

```text
Your last patch failed verification.

Do not broaden scope.
Only inspect the failing test output below and the files you already touched.
Fix the minimum issue needed to satisfy the assigned task.
Do not refactor.
Stop after running the same failing command.

Failing command:
<paste command>

Failing output:
<paste relevant output>
```

If Hermes edits unrelated files:

```text
You edited files outside the allowed scope.

Revert only your unrelated edits and keep the assigned task changes.
Allowed files were:
<list>

After cleanup, run:
git status --short
Stop and report.
```

Codex must never ask Hermes to solve multiple tasks at once.

---

## Final Acceptance Checklist

- [x] Hermes skill/tool exploration completed before implementation.
- [x] One persistent Hermes terminal session was used instead of one-shot prompts.
- [x] Codex created/managed the branch or worktree directly.
- [x] Hermes did not stage, commit, push, or create PRs.
- [x] Codex created commits only after reviewing diffs and running tests.
- [ ] Fresh Hermes sessions were used at domain boundaries or when context became stale/heavy.
- [x] `backend/template.yaml` defines DLQ/RedrivePolicy in repo, not only in AWS console.
- [x] SQS retention and DynamoDB TTL no longer conflict silently.
- [x] `DONE` chat status preserves stored `sanitized`.
- [x] Malformed request IDs are rejected before DynamoDB lookup.
- [x] Frontend hash navigation and Back/Forward behavior are tested.
- [x] Chat API validates runtime JSON.
- [x] Chat polling/request can be aborted on unmount.
- [x] Static frontend data is separated from `App.tsx`, if cleanup task ran.
- [ ] Dead backend handler code is removed, if cleanup task ran.
- [x] Frontend tests pass.
- [x] Frontend build passes.
- [ ] Local AI harness tests pass.
- [ ] Backend unit tests pass.
- [ ] `git diff --check` passes.
- [ ] Codex pushed the verified branch and opened the PR, if requested for execution.
