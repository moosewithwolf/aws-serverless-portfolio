"""Isolated container model client for the Local AI Chatbot harness.

Uses the OpenAI-compatible Chat Completions API (``/v1/chat/completions``)
to talk to an isolated model server running in Docker.  This module is
the **only** place ``requests`` is used — no shell calls, no oMLX / pi /
Hermes routes, no access to host personal files or credentials.

Hard constraints
----------------
* Endpoint is configurable via ``CONTAINER_MODEL_ENDPOINT`` env var.
  Default: ``http://127.0.0.1:8080/v1/chat/completions``.
* Uses ``/v1/chat/completions``, NOT ``/v1/completions``.
* Sends a ``messages`` array (not a raw prompt string).
* Returns the first assistant message's text.
* Raises ``ContainerModelError`` on any failure (structured with HTTP
  status code).
* Timeouts are short to fail fast.
"""

from __future__ import annotations

import json
import os
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Error types
# ---------------------------------------------------------------------------


class ContainerModelError(Exception):
    """Structured error from the container model backend."""

    def __init__(self, status_code: int | None, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"[HTTP {status_code}] {detail}" if status_code else detail)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CONTAINER_MODEL_ENDPOINT: str = os.environ.get(
    "CONTAINER_MODEL_ENDPOINT",
    "http://127.0.0.1:8080/v1/chat/completions",
)

_MODEL_TIMEOUT: float = 15.0  # seconds — fail fast


# ---------------------------------------------------------------------------
# OpenAI-compatible chat client
# ---------------------------------------------------------------------------


def _build_payload(user_message: str) -> dict[str, Any]:
    """Build the Chat Completions JSON payload."""
    return {
        "model": "local-model",
        "messages": [{"role": "user", "content": user_message}],
        "max_tokens": 256,
        "temperature": 0.7,
    }


def parse_chat_response(raw: str) -> str:
    """Parse an OpenAI-compatible Chat Completions response.

    Extracts the ``text`` field from the first assistant message in
    ``choices[0].message``.  Raises ``ContainerModelError`` when the
    response is malformed, missing ``choices``, or missing assistant
    content.
    """
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ContainerModelError(
            status_code=None,
            detail=f"Failed to parse assistant response as JSON: {exc}",
        ) from exc

    choices = data.get("choices")
    if not choices:
        raise ContainerModelError(
            status_code=None,
            detail="Response is missing 'choices' array.",
        )

    first = choices[0]
    message = first.get("message")
    if not message:
        raise ContainerModelError(
            status_code=None,
            detail="Response choice is missing 'message' field.",
        )

    text = message.get("content")
    if not text:
        raise ContainerModelError(
            status_code=None,
            detail="Assistant message content is empty or missing.",
        )

    return text


class ContainerModelBackend:
    """HTTP client that talks to an isolated model server in Docker.

    Uses the OpenAI-compatible ``POST /v1/chat/completions`` endpoint.
    """

    def __init__(
        self,
        endpoint: str | None = None,
        timeout: float = _MODEL_TIMEOUT,
    ) -> None:
        self.endpoint = endpoint or CONTAINER_MODEL_ENDPOINT
        self.timeout = timeout

    def generate(self, prompt: str) -> str:
        """Send *prompt* to the containerised model and return assistant text.

        Raises
        ------
        ContainerModelError
            On connection failure, timeout, invalid JSON, missing choices,
            non-2xx status, or missing assistant content.
        """
        payload = _build_payload(prompt)
        headers = {"Content-Type": "application/json"}

        try:
            resp = requests.post(
                self.endpoint,
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
        except requests.exceptions.ConnectionError as exc:
            raise ContainerModelError(
                status_code=None,
                detail=f"Cannot connect to model server at {self.endpoint}: {exc}",
            ) from exc
        except requests.exceptions.Timeout as exc:
            raise ContainerModelError(
                status_code=None,
                detail=f"Model server request timed out after {self.timeout}s: {exc}",
            ) from exc
        except requests.exceptions.RequestException as exc:
            raise ContainerModelError(
                status_code=None,
                detail=f"Request to model server failed: {exc}",
            ) from exc

        # Non-2xx → structured error
        if resp.status_code < 200 or resp.status_code >= 300:
            raise ContainerModelError(
                status_code=resp.status_code,
                detail=f"Model server returned HTTP {resp.status_code}: {resp.text[:500]}",
            )

        # Parse assistant text
        return parse_chat_response(resp.text)
