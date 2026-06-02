#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local-ai"
PID_FILE="${ROOT_DIR}/.agent/sqs-agent.pid"
PLIST_FILE="${ROOT_DIR}/.agent/com.shinseong.portfolio.local-ai-agent.plist"
LAUNCHD_LABEL="com.shinseong.portfolio.local-ai-agent"

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
CHAT_API_FUNCTION_NAME="${CHAT_API_FUNCTION_NAME:-${LOCAL_AI_FUNCTION_NAME:-}}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: ${name} is required. Copy .env.local-ai.example to .env.local-ai and fill it in." >&2
    exit 1
  fi
}

upload_chat_config() {
  local tmp_file
  tmp_file="$(mktemp)"

  cat > "${tmp_file}" <<JSON
{
  "enabled": false,
  "message": "Chat is currently offline."
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
    --function-name "${CHAT_API_FUNCTION_NAME}" \
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
    --function-name "${CHAT_API_FUNCTION_NAME}" \
    --environment "file://${merged_env}" \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" >/dev/null

  aws lambda wait function-updated \
    --function-name "${CHAT_API_FUNCTION_NAME}" \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}"

  rm -f "${current_env}" "${merged_env}"
}

require_var FRONTEND_BUCKET
require_var CHAT_API_FUNCTION_NAME

upload_chat_config
invalidate_chat_config

update_lambda_chatbot_enabled false

if [[ -f "${PID_FILE}" ]]; then
  AGENT_PID="$(cat "${PID_FILE}")"
  if kill -0 "${AGENT_PID}" 2>/dev/null; then
    kill "${AGENT_PID}"
  fi
  rm -f "${PID_FILE}"
fi

launchctl bootout "gui/$(id -u)" "${PLIST_FILE}" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)/${LAUNCHD_LABEL}" >/dev/null 2>&1 || true

docker compose -f "${COMPOSE_FILE}" down

echo "Agent stopped and chat config set offline."
