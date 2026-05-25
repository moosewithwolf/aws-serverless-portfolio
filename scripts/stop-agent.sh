#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local-ai"
PID_FILE="${ROOT_DIR}/.agent/sqs-agent.pid"

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
    --region "${AWS_REGION}"

  rm -f "${tmp_file}"
}

require_var FRONTEND_BUCKET

upload_chat_config

if [[ -f "${PID_FILE}" ]]; then
  AGENT_PID="$(cat "${PID_FILE}")"
  if kill -0 "${AGENT_PID}" 2>/dev/null; then
    kill "${AGENT_PID}"
  fi
  rm -f "${PID_FILE}"
fi

docker compose -f "${COMPOSE_FILE}" down

echo "Agent stopped and chat config set offline."
