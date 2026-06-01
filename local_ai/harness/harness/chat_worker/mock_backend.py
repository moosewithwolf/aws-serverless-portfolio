"""Mock model backend for the Local AI Chatbot harness.

Implements the `ModelBackend` Protocol with keyword-based routing
to return portfolio-relevant responses. Security-sensitive patterns
(injection, tool-use, credentials) are checked first.
"""

from __future__ import annotations

import re
from typing import Protocol


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------

class ModelBackend(Protocol):
    """Interface all model backends must implement."""

    def generate(self, prompt: str) -> str:
        """Generate a response for the given prompt."""


# ---------------------------------------------------------------------------
# Keyword-to-response map
# ---------------------------------------------------------------------------

_RESPONSES: dict[str, str] = {
    "aws_architecture": (
        "My portfolio backend runs on AWS Lambda with API Gateway. "
        "The frontend is a React SPA hosted on S3 behind CloudFront. "
        "The SAM template defines routes for `/health` and `/profile`. "
        "This v2 adds a `LocalAiFunction` Lambda that processes chat messages"
        " through a Python harness with safety validation."
    ),
    "certifications": (
        "I hold two AWS certifications: AWS Solutions Architect Associate "
        "and AWS Developer Associate. I am currently studying Computer "
        "Programming and Analysis at Seneca Polytechnic with a 4.0 GPA."
    ),
    "projects": (
        "My two featured projects are:\n"
        "1. **NoraHangul** — A student management system built with "
        "Spring Boot, React, and AWS, featuring OAuth2/JWT authentication "
        "and Docker-based deployment.\n"
        "2. **Cloud Native Backend** — A serverless portfolio backend "
        "using API Gateway, Lambda, CloudFront, and S3, with a roadmap "
        "for local AI integration."
    ),
    "skills": (
        "My technical skills include Python, JavaScript, TypeScript, "
        "React, Spring Boot, AWS, Docker, PostgreSQL, and MongoDB. "
        "I specialize in high-performance serverless systems and full-stack engineering."
    ),
    "education": (
        "I am a Computer Programming and Analysis student at Seneca Polytechnic "
        "in Toronto, ON (2024 - Present). I graduated with a 4.0 GPA and "
        "received the Marcus Udokang Computer Science Award in 2026."
    ),
    "prompt_injection": (
        "I cannot process requests that attempt to override my system instructions. "
        "All inputs are validated against safety patterns before being sent to the model."
    ),
    "tool_runtime": (
        "I am an AI assistant and do not have access to a tool runtime, shell, "
        "or browser. I can only provide information and text-based responses "
        "about the portfolio, skills, projects, and AWS architecture."
    ),
    "credential_request": (
        "I do not have access to any credentials, API keys, or secret keys. "
        "Please do not share sensitive information such as AWS access keys, "
        "JWT tokens, or private SSH keys with me."
    ),
    "private_info": (
        "I cannot share private or personal information. My responses are "
        "limited to publicly available portfolio content."
    ),
    "unavailable": (
        "I'm not sure how to respond to that. Please ask about my "
        "skills, projects, certifications, education, or AWS architecture."
    ),
}

# ---------------------------------------------------------------------------
# Pattern priority (checked in order — most dangerous first)
# ---------------------------------------------------------------------------

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"ignore.*instructions|bypass.*rule|act as.*not", re.IGNORECASE), "prompt_injection"),
    (re.compile(r"\boMLX\b|^\bpi\b|Hermes|shell|/bin/|eval\(|exec\(", re.IGNORECASE), "tool_runtime"),
    (re.compile(r"AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |DSA )?PRIVATE KEY|Bearer [a-zA-Z0-9_-]+"), "credential_request"),
    (re.compile(r"/etc/|\.ssh/|\.aws/|\$HOME|/home/", re.IGNORECASE), "private_info"),
    (re.compile(r"\baws\b|serverless|lambda|api gateway|cloudfront|sqs|dynamodb|s3", re.IGNORECASE), "aws_architecture"),
]


# ---------------------------------------------------------------------------
# MockModelBackend
# ---------------------------------------------------------------------------

class MockModelBackend:
    """Keyword-based mock model with priority pattern matching.

    Security-sensitive pattern matching is applied **only** to the
    user message portion of the prompt (text after ``\nUser: ``),
    NOT the full prompt which includes system/context context that
    may contain harmless matches (e.g. "shell access" in a system
    prompt).
    """

    def generate(self, prompt: str) -> str:
        # Extract the user message portion (everything after "\nUser: ")
        # The prompt format is:
        #   Context:\n...system/context...\n\nUser: <message>
        # or simply "User: <message>"
        user_message = prompt
        if "\nUser: " in prompt:
            user_message = prompt.split("\nUser: ", 1)[1]

        # Check security-sensitive patterns only on the user message
        for pattern, keyword in _PATTERNS:
            if pattern.search(user_message):
                return _RESPONSES[keyword]

        # Fall back to keyword matching (on full prompt so context keywords
        # can still be matched)
        prompt_lower = prompt.lower()
        for keyword, response in _RESPONSES.items():
            if keyword in prompt_lower or keyword.replace("_", " ") in prompt_lower:
                return response

        return _RESPONSES["unavailable"]
