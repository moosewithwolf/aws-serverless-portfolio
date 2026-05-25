"""Phase 5 — Secret scanning test.

Verifies that publicly-tracked context files, prompt files, and
docker-compose.yml do not contain obvious secret patterns.

This is a fast, deterministic test that scans a narrow set of files
already covered by safety.py in the harness.
"""

import pathlib
import re
from typing import Iterable, Set

import pytest

# ---------------------------------------------------------------------------
# Secret patterns (mirrors safety.py CONTEXT_PATTERNS)
# ---------------------------------------------------------------------------

_SECRET_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"),
    re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+"),  # JWT token
    re.compile(
        r"(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*['\"]?[A-Za-z0-9+/=_-]{16,}",
        re.IGNORECASE,
    ),
]

# ---------------------------------------------------------------------------
# File set to scan (narrow: context + prompts + compose)
# ---------------------------------------------------------------------------

# Resolve from this test file so the scan works from any checkout path.
_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[4]

_SCAN_PATHS: list[pathlib.Path] = [
    _PROJECT_ROOT / "local_ai" / "harness" / "context" / "profile.md",
    _PROJECT_ROOT / "local_ai" / "harness" / "context" / "projects.md",
    _PROJECT_ROOT / "local_ai" / "harness" / "prompts" / "system_prompt.md",
    _PROJECT_ROOT / "local_ai" / "harness" / "docker-compose.yml",
]


def _read_text_safe(path: pathlib.Path) -> str:
    """Return file contents or empty string if file does not exist."""
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def _find_matches(content: str) -> list[tuple[re.Pattern[str], str]]:
    """Return list of (pattern, line_text) for each secret match."""
    matches: list[tuple[re.Pattern[str], str]] = []
    for pattern in _SECRET_PATTERNS:
        for line_no, line in enumerate(content.splitlines(), start=1):
            if pattern.search(line):
                matches.append((pattern, line.strip()))
    return matches


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def _all_matches() -> list[tuple[pathlib.Path, re.Pattern[str], str, int]]:
    """Scan all tracked files and return (path, pattern, line, line_no) tuples."""
    findings: list[tuple[pathlib.Path, re.Pattern[str], str, int]] = []
    for path in _SCAN_PATHS:
        content = _read_text_safe(path)
        for pattern in _SECRET_PATTERNS:
            for line_no, line in enumerate(content.splitlines(), start=1):
                if pattern.search(line):
                    findings.append((path, pattern, line.strip(), line_no))
    return findings


def test_no_secrets_in_tracked_context_and_prompt_files():
    """Verify no secret patterns are found in scanned public files."""
    findings = _all_matches()
    assert len(findings) == 0, (
        f"Secret patterns detected in tracked files:\n"
        + "\n".join(
            f"  - {f[0].relative_to(_PROJECT_ROOT)}:{f[3]}  →  {f[2][:80]}"
            for f in findings
        )
    )


def test_scan_file_set_is_non_empty():
    """Regression test — ensure the scanned file set actually contains files."""
    existing = [p for p in _SCAN_PATHS if p.exists()]
    assert len(existing) >= 2, (
        f"Expected at least 2 scanned files, got {len(existing)}: {[str(p) for p in _SCAN_PATHS]}"
    )


def test_docker_compose_has_no_secrets():
    """Specifically verify docker-compose.yml has no secrets."""
    compose = _PROJECT_ROOT / "local_ai" / "harness" / "docker-compose.yml"
    content = _read_text_safe(compose)
    for pattern in _SECRET_PATTERNS:
        assert not pattern.search(content), (
            f"docker-compose.yml contains potential secrets matching {pattern.pattern}"
        )
