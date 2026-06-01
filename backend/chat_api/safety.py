"""Safety validation for the portfolio chat API.

Provides regex-based safety checks for:
- Input messages (pre-prompt validation)
- Model outputs (post-generation validation)
- Context files (secret scanning before prompt building)

Returns a boolean indicating whether the content passed all checks.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Input safety patterns (checked before sending to model)
# ---------------------------------------------------------------------------

_INPUT_PATTERNS: list[re.Pattern[str]] = [
    # Empty input
    re.compile(r"^\s*$"),
    # Credential exfiltration — AWS access key
    re.compile(r"AKIA[0-9A-Z]{16}"),
    # Prompt injection
    re.compile(r"ignore.*instructions|bypass.*rule|act as.*not", re.IGNORECASE),
    # Tool-use patterns
    re.compile(r"\boMLX\b|^\bpi\b|Hermes|shell|/bin/|eval\(|exec\(", re.IGNORECASE),
    # File access
    re.compile(r"/etc/|\.ssh/|\.aws/|\$HOME|/home/"),
]


# ---------------------------------------------------------------------------
# Output safety patterns (checked after model generation)
# ---------------------------------------------------------------------------

_OUTPUT_PATTERNS: list[re.Pattern[str]] = [
    # Prompt leakage — model echoes system prompt content
    re.compile(r"you are a helpful portfolio|you cannot share|you do not have access to", re.IGNORECASE),
    # Forbidden resource claims
    re.compile(r"I can (access|read|execute|run|list)\s+(file|/etc|\.ssh|\.aws|shell|process)", re.IGNORECASE),
    # Credential leaks in output
    re.compile(r"AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY"),
]


# ---------------------------------------------------------------------------
# Context file scanning patterns
# ---------------------------------------------------------------------------

_CONTEXT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"),
    re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+"),  # JWT token
    re.compile(r"(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*['\"]?[A-Za-z0-9+/=_-]{16,}"),
]


# ---------------------------------------------------------------------------
# Validation functions
# ---------------------------------------------------------------------------

def validate_input(message: str) -> tuple[bool, str]:
    """Validate an incoming chat message for safety.

    Returns:
        (is_safe, rejection_reason) — empty reason if safe.
    """
    if not message or not message.strip():
        return False, "Empty messages are not allowed."

    if len(message) > 2048:
        return False, f"Message exceeds 2048 character limit ({len(message)} chars)."

    for pattern in _INPUT_PATTERNS:
        if pattern.search(message):
            return False, "Message contains patterns that may indicate injection, credential sharing, or restricted access requests."

    return True, ""


def validate_output(response: str) -> tuple[bool, str]:
    """Validate an outgoing model response for safety.

    Returns:
        (is_safe, concern) — empty concern if safe.
    """
    if len(response) > 4096:
        return False, f"Response exceeds 4096 character limit."

    for pattern in _OUTPUT_PATTERNS:
        if pattern.search(response):
            return False, "Response contains patterns that may indicate prompt leakage or unauthorized resource claims."

    return True, ""


def validate_context_file(file_path: Path) -> tuple[bool, str]:
    """Validate a context file for secrets before loading.

    Returns:
        (is_safe, concern) — empty concern if file is clean.
    """
    try:
        content = file_path.read_text(encoding="utf-8")
    except OSError as e:
        return False, f"Cannot read context file: {e}"

    for pattern in _CONTEXT_PATTERNS:
        if pattern.search(content):
            return False, f"Context file '{file_path.name}' contains potential secrets or sensitive data."

    return True, ""


def validate_safety(
    content: str | Any,
    for_output: bool = False,
) -> bool:
    """Run the appropriate safety check on content.

    This is a convenience wrapper used by the Lambda handler to decide
    whether to include `sanitized: True` in the response.

    Args:
        content: The string to validate.
        for_output: If True, use output patterns; otherwise input patterns.

    Returns:
        True if content passes safety checks.
    """
    if isinstance(content, BaseModel):
        # Pydantic model — extract the relevant field
        if hasattr(content, "message"):
            text = content.message  # type: ignore[attr-defined]
        else:
            text = str(content)
    else:
        text = str(content)

    if for_output:
        is_safe, _ = validate_output(text)
    else:
        is_safe, _ = validate_input(text)

    return is_safe
