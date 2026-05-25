#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local-ai"
PID_FILE="${ROOT_DIR}/.agent/sqs-agent.pid"
LOG_FILE="${ROOT_DIR}/.agent/sqs-agent.log"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

AWS_PROFILE="${AWS_PROFILE:-portfolio}"
AWS_REGION="${AWS_REGION:-ca-central-1}"
S3_REGION="${S3_REGION:-${AWS_REGION}}"
CHAT_CONFIG_KEY="${CHAT_CONFIG_KEY:-chat-config.json}"
CHAT_CONFIG_CACHE_CONTROL="${CHAT_CONFIG_CACHE_CONTROL:-no-cache, max-age=0}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/local_ai/harness/docker-compose.yml}"
LOCAL_AI_BACKEND="${LOCAL_AI_BACKEND:-container}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: ${name} is required. Copy .env.local-ai.example to .env.local-ai and fill it in." >&2
    exit 1
  fi
}

upload_chat_config() {
  local enabled="$1"
  local message="$2"
  local tmp_file
  tmp_file="$(mktemp)"

  cat > "${tmp_file}" <<JSON
{
  "enabled": ${enabled},
  "message": "${message}"
}
JSON

  aws s3 cp "${tmp_file}" "s3://${FRONTEND_BUCKET}/${CHAT_CONFIG_KEY}" \
    --cache-control "${CHAT_CONFIG_CACHE_CONTROL}" \
    --content-type "application/json" \
    --profile "${AWS_PROFILE}" \
    --region "${S3_REGION}"

  rm -f "${tmp_file}"
}

invalidate_chat_config() {
  if [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
    return
  fi

  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
    --paths "/${CHAT_CONFIG_KEY}" \
    --profile "${AWS_PROFILE}" >/dev/null
}

update_lambda_chatbot_enabled() {
  local enabled="$1"
  local current_env
  local merged_env
  current_env="$(mktemp)"
  merged_env="$(mktemp)"

  aws lambda get-function-configuration \
    --function-name "${LOCAL_AI_FUNCTION_NAME}" \
    --query 'Environment.Variables' \
    --output json \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" > "${current_env}"

  "${PYTHON_BIN}" - "${current_env}" "${merged_env}" "${enabled}" <<'PY'
import json
import sys

source, target, enabled = sys.argv[1:4]
with open(source, "r", encoding="utf-8") as fh:
    variables = json.load(fh) or {}
variables["CHATBOT_ENABLED"] = enabled
with open(target, "w", encoding="utf-8") as fh:
    json.dump({"Variables": variables}, fh)
PY

  aws lambda update-function-configuration \
    --function-name "${LOCAL_AI_FUNCTION_NAME}" \
    --environment "file://${merged_env}" \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" >/dev/null

  aws lambda wait function-updated \
    --function-name "${LOCAL_AI_FUNCTION_NAME}" \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}"

  rm -f "${current_env}" "${merged_env}"
}

require_var FRONTEND_BUCKET
require_var CHAT_REQUEST_TABLE
require_var CHAT_QUEUE_URL
require_var LOCAL_AI_FUNCTION_NAME

mkdir -p "${ROOT_DIR}/.agent"

docker compose -f "${COMPOSE_FILE}" up -d

export PYTHONPATH="${ROOT_DIR}/local_ai/harness"
export CHAT_REQUEST_TABLE
export CHAT_QUEUE_URL
export LOCAL_AI_BACKEND
export AWS_REGION
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION}}"
export AWS_PROFILE

if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "Agent is already running with PID $(cat "${PID_FILE}")."
else
  nohup "${ROOT_DIR}/.venv/bin/python" -m harness.sqs_agent > "${LOG_FILE}" 2>&1 &
  echo "$!" > "${PID_FILE}"
fi

update_lambda_chatbot_enabled true
upload_chat_config true "Chat is online."
invalidate_chat_config

echo "Agent started with PID $(cat "${PID_FILE}")."
echo "Log: ${LOG_FILE}"
