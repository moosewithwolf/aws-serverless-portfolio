"""Contract models for the Local AI Chatbot harness.

Pydantic models that define the API contract between the Lambda handler
and the frontend, and between the harness and external callers.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ChatStatus(str, Enum):
    """Status of a chat request lifecycle."""

    PENDING = "PENDING"
    DONE = "DONE"
    ERROR = "ERROR"


class ChatRequest(BaseModel):
    """Incoming chat message from the frontend."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2048,
        description="The user's chat message.",
    )


class ChatResponse(BaseModel):
    """Response returned after processing a chat request."""

    request_id: str = Field(
        ...,
        description="Unique identifier for this chat request, used for polling.",
    )
    status: ChatStatus = Field(
        ...,
        description="Current processing status.",
    )
    message: str = Field(
        ...,
        description="Response text from the model (empty when PENDING).",
    )
    sanitized: bool = Field(
        ...,
        description="Whether the response passed safety validation.",
    )


class ChatStatusResponse(BaseModel):
    """Status update returned by the polling endpoint."""

    status: ChatStatus = Field(
        ...,
        description="Current processing status.",
    )
    message: str = Field(
        default="",
        description="Optional status message (e.g., error reason on ERROR).",
    )
