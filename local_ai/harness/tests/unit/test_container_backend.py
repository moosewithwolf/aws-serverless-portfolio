"""Unit tests for the container model client (container_model_client.py).

Tests verify that the OpenAI-compatible Chat Completions client handles
success, timeout, non-2xx, invalid JSON, and missing content correctly.
"""

import json
from unittest.mock import patch

import pytest
import requests

from local_agent.chat_worker.container_model_client import (
    ContainerModelBackend,
    ContainerModelError,
    CONTAINER_MODEL_ENDPOINT,
    parse_chat_response,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _mock_response(status_code: int, body: dict) -> requests.Response:
    """Build a mock requests.Response."""
    resp = requests.Response()
    resp.status_code = status_code
    resp._content = json.dumps(body).encode("utf-8")
    return resp


# ---------------------------------------------------------------------------
# Successful chat completion
# ---------------------------------------------------------------------------


def test_successful_chat_completion_parses_assistant_message():
    """Verify a 200 response with valid choices returns assistant text."""
    mock_resp = _mock_response(200, {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": "This portfolio uses S3, CloudFront, and Lambda.",
            }
        }]
    })

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        result = backend.generate("What services are used?")

    assert result == "This portfolio uses S3, CloudFront, and Lambda."


# ---------------------------------------------------------------------------
# Timeout / connection failure
# ---------------------------------------------------------------------------


def test_connection_failure_returns_controlled_error():
    """Verify a ConnectionError is wrapped in ContainerModelError."""
    with patch(
        "local_agent.chat_worker.container_model_client.requests.post",
        side_effect=requests.exceptions.ConnectionError("refused"),
    ):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code is None
    assert "Cannot connect" in exc_info.value.detail


def test_timeout_returns_controlled_error():
    """Verify a Timeout is wrapped in ContainerModelError."""
    with patch(
        "local_agent.chat_worker.container_model_client.requests.post",
        side_effect=requests.exceptions.Timeout("timed out"),
    ):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code is None
    assert "timed out" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Non-2xx response
# ---------------------------------------------------------------------------


def test_non_2xx_response_returns_controlled_error():
    """Verify a 500 response raises ContainerModelError with status_code."""
    mock_resp = _mock_response(500, {"error": {"message": "server error"}})

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code == 500
    assert "server error" in exc_info.value.detail


def test_429_response_returns_controlled_error():
    """Verify a 429 (rate limit) raises ContainerModelError."""
    mock_resp = _mock_response(429, {"error": {"message": "rate limited"}})

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code == 429


# ---------------------------------------------------------------------------
# Invalid JSON response
# ---------------------------------------------------------------------------


def test_invalid_json_returns_controlled_error():
    """Verify non-JSON response is caught by parse_chat_response."""
    mock_resp = requests.Response()
    mock_resp.status_code = 200
    mock_resp._content = b"not json at all"

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code is None
    assert "Failed to parse" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Missing assistant content
# ---------------------------------------------------------------------------


def test_missing_choices_returns_controlled_error():
    """Verify response without 'choices' raises ContainerModelError."""
    mock_resp = _mock_response(200, {"id": "some-id", "model": "test"})

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code is None
    assert "missing 'choices'" in exc_info.value.detail


def test_empty_choices_returns_controlled_error():
    """Verify response with empty choices array raises ContainerModelError."""
    mock_resp = _mock_response(200, {"choices": []})

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code is None
    assert "missing 'choices'" in exc_info.value.detail


def test_missing_message_field_returns_controlled_error():
    """Verify choice without 'message' raises ContainerModelError."""
    mock_resp = _mock_response(200, {"choices": [{"finish_reason": "stop"}]})

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code is None
    assert "missing 'message'" in exc_info.value.detail


def test_empty_content_returns_controlled_error():
    """Verify choice with empty content raises ContainerModelError."""
    mock_resp = _mock_response(200, {
        "choices": [{"message": {"role": "assistant", "content": ""}}]
    })

    with patch("local_agent.chat_worker.container_model_client.requests.post", return_value=mock_resp):
        backend = ContainerModelBackend()
        with pytest.raises(ContainerModelError) as exc_info:
            backend.generate("test")

    assert exc_info.value.status_code is None
    assert "empty or missing" in exc_info.value.detail


# ---------------------------------------------------------------------------
# parse_chat_response standalone
# ---------------------------------------------------------------------------


def test_parse_chat_response_with_nested_structure():
    """Verify parse handles full OpenAI-style response dict."""
    full = {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "model": "local-model",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": "Hello world"},
            "finish_reason": "stop",
        }],
    }
    assert parse_chat_response(json.dumps(full)) == "Hello world"
