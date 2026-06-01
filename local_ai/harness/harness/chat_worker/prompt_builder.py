"""Prompt builder for the Local AI Chatbot harness.

Loads the system prompt file first, then loads portfolio context files
in a deterministic, sorted order. Context files are validated with the
safety scanner before being included. Assembles everything into a single
system prompt prefix for the model.
"""

from __future__ import annotations

import functools
from pathlib import Path
from typing import Optional

from harness.shared.safety import validate_context_file

_ROOT = Path(__file__).parents[2]  # local_ai/harness/


# ---------------------------------------------------------------------------
# File paths — system prompt first, then context files in sorted order
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT_PATH: Path = _ROOT / "prompts" / "system_prompt.md"

_CONTEXT_FILES: list[Path] = sorted(
    [_ROOT / "context" / "profile.md", _ROOT / "context" / "projects.md"],
    key=lambda p: p.name,
)


@functools.lru_cache(maxsize=1)
def load_context() -> Optional[str]:
    """Load and concatenate the system prompt plus validated context files.

    Returns:
        A single string with the system prompt followed by all validated
        context files (newline-separated), or `None` if the system prompt
        cannot be loaded.
    """
    parts: list[str] = []

    # System prompt (always required)
    if _SYSTEM_PROMPT_PATH.exists():
        parts.append(f"--- { _SYSTEM_PROMPT_PATH.name} ---\n{_SYSTEM_PROMPT_PATH.read_text(encoding='utf-8')}")

    # Context files — validate each before including
    for file_path in _CONTEXT_FILES:
        if not file_path.exists():
            continue
        is_safe, concern = validate_context_file(file_path)
        if not is_safe:
            # Skip the file if it fails safety validation
            continue
        parts.append(f"--- {file_path.name} ---\n{file_path.read_text(encoding='utf-8')}")

    return "\n\n".join(parts) if parts else None
