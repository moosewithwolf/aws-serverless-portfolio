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
CHAT_CONFIG_KEY="${CHAT_CONFIG_KEY:-chat-config.json}"
CHAT_CONFIG_CACHE_CONTROL="${CHAT_CONFIG_CACHE_CONTROL:-no-cache, max-age=0}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/local_ai/harness/docker-compose.yml}"
LOCAL_AI_BACKEND="${LOCAL_AI_BACKEND:-container}"

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
    --region "${AWS_REGION}"

  rm -f "${tmp_file}"
}

require_var FRONTEND_BUCKET
require_var CHAT_REQUEST_TABLE
require_var CHAT_QUEUE_URL

mkdir -p "${ROOT_DIR}/.agent"

if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "Agent is already running with PID $(cat "${PID_FILE}")."
  exit 0
fi

docker compose -f "${COMPOSE_FILE}" up -d

export PYTHONPATH="${ROOT_DIR}/local_ai/harness"
export CHAT_REQUEST_TABLE
export CHAT_QUEUE_URL
export LOCAL_AI_BACKEND

nohup "${ROOT_DIR}/.venv/bin/python" -m harness.sqs_agent > "${LOG_FILE}" 2>&1 &
echo "$!" > "${PID_FILE}"

upload_chat_config true "Chat is online."

echo "Agent started with PID $(cat "${PID_FILE}")."
echo "Log: ${LOG_FILE}"
