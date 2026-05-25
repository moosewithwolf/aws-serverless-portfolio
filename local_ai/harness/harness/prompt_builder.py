"""Prompt builder for the Local AI Chatbot harness.

Loads portfolio context files in a deterministic, sorted order and
assembles them into a system prompt prefix. Files are loaded lazily
with an LRU cache so the I/O cost is paid only once per Lambda
invocation cold start.
"""

from __future__ import annotations

import functools
from pathlib import Path
from typing import Optional

_ROOT = Path(__file__).parent.parent  # local_ai/harness/

# Explicit sorted list — NOT raw glob, so no unknown files are included
_CONTEXT_FILES: list[Path] = sorted(
    [_ROOT / "context" / "profile.md", _ROOT / "context" / "projects.md", _ROOT / "context" / "resume.md"],
    key=lambda p: p.name,
)


@functools.lru_cache(maxsize=1)
def load_context() -> Optional[str]:
    """Load and concatenate all context files.

    Returns:
        A single string with all context files concatenated (newline-separated),
        or `None` if no context files exist.
    """
    parts: list[str] = []
    for file_path in _CONTEXT_FILES:
        if file_path.exists():
            parts.append(f"--- {file_path.name} ---\n{file_path.read_text(encoding='utf-8')}")
        # Skip silently if file does not exist (e.g., resume.md not yet created)

    return "\n\n".join(parts) if parts else None
