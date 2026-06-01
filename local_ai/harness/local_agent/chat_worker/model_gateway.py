"""Reusable model processing gateway.

Centralises the prompt → model → safety pipeline so the CLI harness
and the SQS agent share one processing path.

Usage
-----
    from local_agent.chat_worker.model_gateway import process_message

    result = process_message("Tell me about AWS", request_id="chat_abc123")
    # → {"requestId": "...", "status": "DONE", "message": "...", "sanitized": True}
"""

from __future__ import annotations

import uuid
from typing import Optional

from local_agent.shared.contracts import ChatStatus
from local_agent import get_backend
from local_agent.chat_worker.container_model_client import ContainerModelError
from local_agent.chat_worker.prompt_builder import load_context
from local_agent.shared.safety import validate_input, validate_output

SAFE_FALLBACK_MESSAGE = (
    "I cannot share that information. Please ask about my skills, "
    "projects, certifications, education, or AWS architecture."
)


def _build_prompt(message: str, context: Optional[str]) -> str:
    """Build the full prompt sent to the model."""
    parts: list[str] = []
    if context:
        parts.append(f"Context:\n{context}")
    parts.append(f"User: {message}")
    return "\n\n".join(parts)


def process_message(message: str, request_id: Optional[str] = None) -> dict:
    """Process a chat message through the model pipeline.

    This function is the single source of truth for model processing.
    Both the CLI harness (run_chat.py) and the SQS agent (sqs_agent.py)
    call this function instead of duplicating the pipeline logic.

    Args:
        message: The user's chat message.
        request_id: Optional stable identifier; auto-generated if absent.

    Returns:
        dict with keys: requestId, status, message, sanitized
    """
    rid = request_id or uuid.uuid4().hex[:12]

    # ── Input safety check ──────────────────────────────────────────────
    is_safe, reason = validate_input(message)
    if not is_safe:
        return {
            "requestId": rid,
            "status": ChatStatus.ERROR.value,
            "message": reason,
            "sanitized": False,
        }

    # ── Build prompt ────────────────────────────────────────────────────
    context = load_context()
    prompt = _build_prompt(message, context)

    # ── Model inference ─────────────────────────────────────────────────
    backend = get_backend()
    try:
        raw_response = backend.generate(prompt)
    except ContainerModelError:
        return {
            "requestId": rid,
            "status": ChatStatus.ERROR.value,
            "message": "The model service is temporarily unavailable. Please try again later.",
            "sanitized": False,
        }
    except Exception:
        # Catch-all: never expose internal exception details.
        return {
            "requestId": rid,
            "status": ChatStatus.ERROR.value,
            "message": "The model service is temporarily unavailable. Please try again later.",
            "sanitized": False,
        }

    # ── Output safety check ─────────────────────────────────────────────
    output_safe, _ = validate_output(raw_response)
    if not output_safe:
        raw_response = SAFE_FALLBACK_MESSAGE

    return {
        "requestId": rid,
        "status": ChatStatus.DONE.value,
        "message": raw_response,
        "sanitized": output_safe,
    }
