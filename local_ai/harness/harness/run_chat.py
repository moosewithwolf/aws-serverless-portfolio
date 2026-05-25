"""CLI chat harness for the Local AI Chatbot.

Accepts a message from the command line, processes it through the same
mock backend pipeline as the Lambda handler, and prints stable JSON
output with requestId, status, message, and sanitized fields.

Usage:
    PYTHONPATH=local_ai/harness python -m harness.run_chat "Your message here"
    or
    PYTHONPATH=local_ai/harness python harness/run_chat.py "Your message here"
"""

from __future__ import annotations

import json
import sys
import uuid

from harness.contracts import ChatStatus
from harness.mock_backend import MockModelBackend
from harness.prompt_builder import load_context
from harness.safety import validate_input, validate_output


def _build_prompt(message: str, context: str | None) -> str:
    """Build the full prompt sent to the model."""
    parts: list[str] = []
    if context:
        parts.append(f"Context:\n{context}")
    parts.append(f"User: {message}")
    return "\n\n".join(parts)


def main() -> None:
    """Run the chat harness from the command line."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "requestId": "",
            "status": "ERROR",
            "message": "Usage: python run_chat.py <message>",
            "sanitized": False,
        }))
        sys.exit(1)

    message = " ".join(sys.argv[1:])

    # Validate input
    is_safe, reason = validate_input(message)
    if not is_safe:
        print(json.dumps({
            "requestId": uuid.uuid4().hex[:12],
            "status": ChatStatus.ERROR.value,
            "message": reason,
            "sanitized": False,
        }))
        return

    # Build context and prompt
    context_text = load_context()
    full_prompt = _build_prompt(message, context_text)

    # Generate response via mock backend
    backend = MockModelBackend()
    raw_response = backend.generate(full_prompt)

    # Output safety check
    output_safe, _ = validate_output(raw_response)

    # If output fails safety check, replace with safe fallback
    if not output_safe:
        raw_response = "I cannot share that information. Please ask about my skills, projects, certifications, education, or AWS architecture."

    # Print stable JSON output
    print(json.dumps({
        "requestId": uuid.uuid4().hex[:12],
        "status": ChatStatus.DONE.value,
        "message": raw_response,
        "sanitized": output_safe,
    }))


if __name__ == "__main__":
    main()
