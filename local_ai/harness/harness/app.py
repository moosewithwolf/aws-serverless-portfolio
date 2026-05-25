"""Lambda handler for the Local AI Chatbot harness.

Routes incoming API Gateway events to the harness, applies safety
validation, serialises responses with camelCase keys, and returns
the standard API Gateway proxy integration envelope.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from harness.contracts import ChatRequest, ChatResponse, ChatStatus, ChatStatusResponse
from harness import get_backend
from harness.container_model_client import ContainerModelError
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
# Lambda entry point
# ---------------------------------------------------------------------------

def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """API Gateway Lambda handler for the chat endpoint.

    Handles:
    - POST /chat   — submit a message
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
# POST /chat — handle incoming chat message
# ---------------------------------------------------------------------------

def _handle_chat_post(event: dict[str, Any]) -> dict[str, Any]:
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

    # Build context
    context_text = load_context()
    full_prompt = _build_prompt(request.message, context_text)

    # Generate response via selected backend (mock or container)
    backend = get_backend()
    try:
        raw_response = backend.generate(full_prompt)
    except ContainerModelError:
        # Backend failure → return safe error to caller
        error_response = ChatResponse(
            request_id=_generate_request_id(),
            status=ChatStatus.ERROR,
            message="The model service is temporarily unavailable. Please try again later.",
            sanitized=False,
        )
        return _response(503, _to_camel_case(_model_to_dict(error_response)))

    # Output safety check
    output_safe, _ = validate_output(raw_response)

    # If output fails safety check, replace with safe fallback
    if not output_safe:
        raw_response = "I cannot share that information. Please ask about my skills, projects, certifications, education, or AWS architecture."

    # Build response with camelCase keys for the frontend
    response = ChatResponse(
        request_id=_generate_request_id(),
        status=ChatStatus.DONE,
        message=raw_response,
        sanitized=output_safe,
    )

    return _response(200, _to_camel_case(_model_to_dict(response)))


# ---------------------------------------------------------------------------
# GET /chat/<requestId> — poll status
# ---------------------------------------------------------------------------

def _handle_chat_get(request_id: str) -> dict[str, Any]:
    """Poll endpoint — returns the latest status for a request ID.

    In Phase 1 (mock backend, synchronous), the result is always DONE.
    Later phases (DynamoDB persistence, SQS) will store intermediate
    states here.
    """
    status_resp = ChatStatusResponse(
        status=ChatStatus.DONE,
        message="Processing complete.",
    )
    return _response(200, _to_camel_case(_model_to_dict(status_resp)))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_prompt(message: str, context: str | None) -> str:
    """Build the full prompt sent to the model."""
    parts: list[str] = []
    if context:
        parts.append(f"Context:\n{context}")
    parts.append(f"User: {message}")
    return "\n\n".join(parts)


def _generate_request_id() -> str:
    """Generate a simple request ID for tracking."""
    return uuid.uuid4().hex[:12]


def _model_to_dict(model: Any) -> dict[str, Any]:
    """Convert a Pydantic model to a snake_case dict."""
    if hasattr(model, "model_dump"):
        # Pydantic v2
        return model.model_dump()  # type: ignore[attr-defined]
    elif hasattr(model, "dict"):
        # Pydantic v1
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
