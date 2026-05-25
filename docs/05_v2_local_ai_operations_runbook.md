# 05 V2 Local AI Operations Runbook

## Overview

This runbook covers day-to-day operations for the Local AI Chatbot v2 harness:
starting and stopping the model container, running the SQS agent, verifying
endpoints, and troubleshooting common issues.

---

## 1. Prerequisites

### Install Python dependencies

```bash
cd local_ai/harness
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Required environment variables

| Variable | Description | Example |
|---|---|---|
| `LOCAL_AI_BACKEND` | Either `mock` or `container` | `container` |
| `CONTAINER_MODEL_ENDPOINT` | llama.cpp Chat Completions endpoint (only for `container` backend) | `http://127.0.0.1:8080/v1/chat/completions` |
| `CHAT_QUEUE_URL` | SQS queue URL (AWS agent mode) | `https://sqs.ca-central-1.amazonaws.com/<account-id>/<queue-name>` |
| `CHAT_REQUEST_TABLE` | DynamoDB table name (AWS agent mode) | `chat-requests` |
| `AWS_PROFILE` | AWS CLI profile (if using AWS credentials) | `portfolio` |

---

## 2. Starting the Model Container

### Start llama.cpp container

```bash
cd local_ai/harness
docker-compose -f docker-compose.yml up -d
```

This starts `ghcr.io/ggml-org/llama.cpp:server` bound to `127.0.0.1:8080`
with read-only model volumes.

### Verify the container is healthy

```bash
curl -s http://127.0.0.1:8080/health
```

Expected response (llama.cpp server):
```json
{"status":"ok"}
```

### Test a chat completion

```bash
curl -s http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-model",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 32
  }'
```

### Stop the container

```bash
cd local_ai/harness
docker-compose -f docker-compose.yml down
```

---

## 3. Running the CLI Harness

### One-time smoke test (mock backend)

```bash
cd local_ai/harness
source .venv/bin/activate
LOCAL_AI_BACKEND=mock python -m harness.run_chat "Tell me about AWS services"
```

### One-time smoke test (container backend)

```bash
cd local_ai/harness
source .venv/bin/activate
LOCAL_AI_BACKEND=container CONTAINER_MODEL_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions \
  python -m harness.run_chat "Tell me about AWS services"
```

---

## 4. Running the SQS Polling Agent

### Run once (dry-run — processes one message then exits)

```bash
cd local_ai/harness
source .venv/bin/activate
export CHAT_QUEUE_URL="https://sqs.ca-central-1.amazonaws.com/<account-id>/<queue-name>"
export CHAT_REQUEST_TABLE="chat-requests"
export AWS_PROFILE="portfolio"

LOCAL_AI_BACKEND=container CONTAINER_MODEL_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions \
  python -m harness.sqs_agent --once
```

### Run continuously (daemon)

```bash
LOCAL_AI_BACKEND=container CONTAINER_MODEL_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions \
  python -m harness.sqs_agent
```

### Stop the agent

Press `Ctrl+C` in the terminal running the agent.

---

## 5. Frontend

### Build the React app

```bash
cd frontend
npm run build
```

### Run tests

```bash
cd frontend
npm test -- --run
```

---

## 6. AWS Resource Management

### DynamoDB TTL

The `chat-requests` table has TTL enabled on the `ttl` attribute (3600 seconds).
TTL scans run asynchronously — old items may persist for up to 48 hours.

### Manual AWS Budget Alarm Setup (Phase 5)

AWS Budgets requires an SNS topic with email contact. Since email addresses are
not stored in code, set up the budget manually:

1. Go to the AWS Console → **Billing → Budgets → Create budget**
2. Select **Cost budget**
3. Set **Monthly amount** to **$5.00** (adjust as needed)
4. Set **Budget period** to calendar month
5. Under **Alert thresholds**, add:
   - **At 50% of predicted total** → no action
   - **At 80% of predicted total** → no action
   - **At 100% of predicted total** → **Create SNS alert**
     - Create a new SNS topic (e.g., `Portfolio-AWS-Budget`)
     - Add your email as the endpoint
6. Review and create

This will email you when AWS charges approach or exceed $5/month.

---

## 7. Troubleshooting

### Port 8080 already in use

```bash
# Find the process using port 8080
lsof -i :8080

# Stop it
kill -9 <PID>
```

Then restart the container:
```bash
cd local_ai/harness
docker-compose -f docker-compose.yml up -d
```

### Container won't start

Check logs:
```bash
docker logs local_ai_model
```

Common issues:
- **Model file not found**: Ensure `/Users/shinseong/Desktop/ai-models/Korean-Gemma-2B-Instruct.Q4_K_M.gguf` exists
- **Docker not running**: `open /Applications/Docker.app`
- **Insufficient memory**: llama.cpp quantized models need ~2-4 GB RAM

### Lambda function deployment fails

```bash
cd backend
sam validate --lint || sam validate
```

### SQS agent stuck on empty queue

The SQS agent receives an empty list from SQS. It sleeps and retries — this is
normal behavior when the queue is empty.

### Frontend shows "offline" error

1. Ensure the model container is running (`docker ps | grep local_ai_model`)
2. Verify the container responds: `curl http://127.0.0.1:8080/health`
3. Check the browser console for network errors

---

## 8. Safety Checklist

Before every deployment or public release:

- [ ] `docker-compose.yml` only binds `127.0.0.1` (not `0.0.0.0`)
- [ ] Model volume mount is read-only (`:ro`)
- [ ] No Docker socket mount
- [ ] No `.aws` or `.ssh` directory mounts
- [ ] No secret patterns in context/prompts/compose files (run `pytest tests/unit/test_secret_scan.py`)
- [ ] Input validation rejects empty, over-length, and injection attempts
- [ ] Output validation rejects prompt leakage and credential leaks
- [ ] DynamoDB TTL is enabled
- [ ] No secrets are committed to git (check `.gitignore` includes `.env`)
