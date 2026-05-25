"""Lambda handler for the Local AI Chatbot harness.

Routes incoming API Gateway events to the harness, applies safety
validation, serialises responses with camelCase keys, and returns
the standard API Gateway proxy integration envelope.

Phase 3 — AWS async chat relay:
- POST /chat validates input, stores PENDING in DynamoDB, sends SQS message,
  and returns { requestId, status: "PENDING" }.
- GET /chat/<requestId> reads from DynamoDB and returns the current status.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any

import boto3

from harness.contracts import ChatRequest, ChatResponse, ChatStatus, ChatStatusResponse
from harness.prompt_builder import load_context
from harness.safety import validate_input, validate_output


# ---------------------------------------------------------------------------
# CORS — supports GET, POST, OPTIONS
# ---------------------------------------------------------------------------

CORS_HEADERS: dict[str, str] = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

# ---------------------------------------------------------------------------
# Safe fallback when output safety fails
# ---------------------------------------------------------------------------

SAFE_FALLBACK_MESSAGE = (
    "I cannot share that information. Please ask about my skills, "
    "projects, certifications, education, or AWS architecture."
)

# ---------------------------------------------------------------------------
# AWS resource helpers (lazy client creation, testable via patching)
# ---------------------------------------------------------------------------


def _chat_table_name() -> str:
    """Return the DynamoDB table name from environment."""
    return os.environ.get("CHAT_REQUEST_TABLE", "")


def _chat_queue_url() -> str:
    """Return the SQS queue URL from environment."""
    return os.environ.get("CHAT_QUEUE_URL", "")


def _chat_ttl_seconds() -> int:
    """Return the TTL in seconds from environment."""
    try:
        return int(os.environ.get("CHAT_TTL_SECONDS", "3600"))
    except (ValueError, TypeError):
        return 3600


def _now_epoch() -> int:
    """Return the current epoch time in seconds (int)."""
    return int(time.time())


def _ttl_epoch() -> int:
    """Return the TTL expiration epoch timestamp."""
    return _now_epoch() + _chat_ttl_seconds()


def _ddb_resource():
    """Return a DynamoDB resource (lazy, testable via patching)."""
    return boto3.resource("dynamodb")


def _sqs_resource():
    """Return an SQS resource (lazy, testable via patching)."""
    return boto3.resource("sqs")


# ---------------------------------------------------------------------------
# Lambda entry point
# ---------------------------------------------------------------------------

def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """API Gateway Lambda handler for the chat endpoint.

    Handles:
    - POST /chat   — submit a message (async relay)
    - GET  /chat/<requestId> — poll status
    - OPTIONS      — CORS preflight
    """
    method = _method(event)
    path = _path(event)

    # CORS preflight
    if method == "OPTIONS":
        return _response(204, None)

    # Route dispatch
    if path == "/chat" and method == "POST":
        return _handle_chat_post(event)

    if path.startswith("/chat/") and method == "GET":
        request_id = path.split("/chat/", 1)[1]
        return _handle_chat_get(request_id)

    # Unknown route
    return _response(404, {"message": "Not found"})


# ---------------------------------------------------------------------------
# POST /chat — async relay: validate, store PENDING, enqueue SQS
# ---------------------------------------------------------------------------

def _handle_chat_post(event: dict[str, Any]) -> dict[str, Any]:
    """Handle an incoming chat message via async relay.

    Validates input, stores PENDING state in DynamoDB, sends an SQS job,
    and returns requestId with status PENDING.
    """
    # Parse and validate request body
    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        return _response(400, {"message": "Invalid JSON body"})

    try:
        request = ChatRequest.model_validate(body)  # type: ignore[arg-type]
    except Exception:
        return _response(400, {"message": "Request body must include 'message' (string)"})

    # Input safety check
    is_safe, reason = validate_input(request.message)
    if not is_safe:
        return _response(400, {"message": reason, "sanitized": False})

    # Generate requestId
    request_id = f"chat_{uuid.uuid4().hex}"

    # Store PENDING state in DynamoDB
    ddb_ok = _store_pending_request(request_id, request.message)
    if not ddb_ok:
        return _response(
            503, {
                "status": "ERROR",
                "message": "Service unavailable. Please try again later.",
                "sanitized": False,
            }
        )

    # Send SQS message
    sqs_ok = _send_chat_job(request_id, request.message)
    if not sqs_ok:
        return _response(
            503, {
                "status": "ERROR",
                "message": "Service unavailable. Please try again later.",
                "sanitized": False,
            }
        )

    # Return 202 Accepted with PENDING status
    response_data = {
        "requestId": request_id,
        "status": ChatStatus.PENDING.value,
    }
    return _response(202, _to_camel_case(response_data))


def _store_pending_request(request_id: str, message: str) -> bool:
    """Store a PENDING chat request in DynamoDB.

    Returns True on success, False if the table name is missing
    or the put_item call fails.
    """
    table_name = _chat_table_name()
    if not table_name:
        return False

    try:
        ddb = _ddb_resource()
        table = ddb.Table(table_name)
        table.put_item(
            Item={
                "requestId": request_id,
                "status": ChatStatus.PENDING.value,
                "message": message,
                "createdAt": _now_epoch(),
                "ttl": _ttl_epoch(),
            }
        )
        return True
    except Exception:
        return False


def _send_chat_job(request_id: str, message: str) -> bool:
    """Send a chat job to the SQS queue.

    Returns True on success, False if the queue URL is missing
    or the send_message call fails.
    """
    queue_url = _chat_queue_url()
    if not queue_url:
        return False

    try:
        sqs = _sqs_resource()
        queue = sqs.Queue(queue_url)
        queue.send_message(
            MessageBody=json.dumps({
                "requestId": request_id,
                "message": message,
            }),
        )
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# GET /chat/<requestId> — poll status from DynamoDB
# ---------------------------------------------------------------------------

def _handle_chat_get(request_id: str) -> dict[str, Any]:
    """Poll endpoint — reads status from DynamoDB.

    Returns:
    - 404 if request not found
    - 200 with PENDING/DONE/ERROR status
    - Never exposes internal errors
    """
    table_name = _chat_table_name()
    if not table_name:
        return _response(404, {"message": "Request not found"})

    try:
        ddb = _ddb_resource()
        table = ddb.Table(table_name)
        response = table.get_item(Key={"requestId": request_id})
    except Exception:
        return _response(
            503, {
                "status": "ERROR",
                "message": "Service unavailable. Please try again later.",
                "sanitized": False,
            }
        )

    item = response.get("Item")
    if not item:
        return _response(404, {"message": "Request not found"})

    status = item.get("status", ChatStatus.PENDING.value)

    if status == ChatStatus.PENDING.value:
        return _response(200, _to_camel_case({
            "requestId": request_id,
            "status": ChatStatus.PENDING.value,
        }))

    if status == ChatStatus.DONE.value:
        return _response(200, _to_camel_case({
            "requestId": request_id,
            "status": ChatStatus.DONE.value,
            "message": item.get("message", ""),
            "sanitized": True,
        }))

    if status == ChatStatus.ERROR.value:
        return _response(200, _to_camel_case({
            "requestId": request_id,
            "status": ChatStatus.ERROR.value,
            "message": item.get("message", "Processing failed. Please try again later."),
            "sanitized": False,
        }))

    # Unknown status — treat as PENDING
    return _response(200, _to_camel_case({
        "requestId": request_id,
        "status": ChatStatus.PENDING.value,
    }))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_prompt(message: str, context: str | None) -> str:
    """Build the full prompt sent to the model.

    Used by CLI harness (run_chat.py), not by Lambda POST /chat.
    """
    parts: list[str] = []
    if context:
        parts.append(f"Context:\n{context}")
    parts.append(f"User: {message}")
    return "\n\n".join(parts)


def _model_to_dict(model: Any) -> dict[str, Any]:
    """Convert a Pydantic model to a snake_case dict."""
    if hasattr(model, "model_dump"):
        return model.model_dump()  # type: ignore[attr-defined]
    elif hasattr(model, "dict"):
        return model.dict()
    return {}


def _to_camel_case(data: dict[str, Any]) -> dict[str, Any]:
    """Recursively convert snake_case keys to camelCase."""
    result: dict[str, Any] = {}
    for key, value in data.items():
        camel_key = _snake_to_camel(key)
        if isinstance(value, dict):
            result[camel_key] = _to_camel_case(value)
        elif isinstance(value, list):
            result[camel_key] = [
                _to_camel_case(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[camel_key] = value
    return result


def _snake_to_camel(name: str) -> str:
    """Convert a snake_case string to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


# ---------------------------------------------------------------------------
# API Gateway envelope
# ---------------------------------------------------------------------------

def _response(status_code: int, payload: dict[str, Any] | None) -> dict[str, Any]:
    """Build the API Gateway proxy integration response envelope."""
    response: dict[str, Any] = {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
    }
    if payload is not None:
        response["body"] = json.dumps(payload)
    else:
        response["body"] = ""
    return response


# ---------------------------------------------------------------------------
# Event parsing (dual-format: API Gateway v1 + v2)
# ---------------------------------------------------------------------------

def _method(event: dict[str, Any]) -> str:
    return (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", event.get("httpMethod", "GET"))
    )


def _path(event: dict[str, Any]) -> str:
    return event.get("rawPath") or event.get("path") or "/"
