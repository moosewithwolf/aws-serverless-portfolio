"""Local AI Chatbot Harness — init module.

Exposes shared backend selection helpers for the chat worker and CLI harness.

Backend selection is controlled by the ``LOCAL_AI_BACKEND`` environment
variable:

* ``mock`` (default) — keyword-based mock responses for local development.
* ``container`` — live model server in an isolated Docker container.

Example::

    LOCAL_AI_BACKEND=container python -m local_agent.run_chat "Hello"
"""

import os

from local_agent.shared import contracts  # noqa: F401 — expose contract models
from local_agent.chat_worker.mock_backend import MockModelBackend  # noqa: F401
from local_agent.shared.safety import validate_safety  # noqa: F401
from local_agent.chat_worker.prompt_builder import load_context  # noqa: F401

# Lazy import of container backend to avoid importing requests at startup
try:
    from local_agent.chat_worker.container_model_client import (
        ContainerModelBackend,  # noqa: F401
    )
except ImportError:  # requests not installed
    ContainerModelBackend = None  # type: ignore[misc,assignment]


def get_backend():
    """Return the configured model backend instance.

    Reads ``LOCAL_AI_BACKEND`` env var.
    Defaults to ``mock``.

    Returns
    -------
    ModelBackend
        A ``MockModelBackend`` or ``ContainerModelBackend`` instance.

    Raises
    ------
    ValueError
        If ``LOCAL_AI_BACKEND`` is set to an unknown value.
    """
    backend = os.environ.get("LOCAL_AI_BACKEND", "mock").lower().strip()
    if backend == "mock":
        return MockModelBackend()
    if backend == "container":
        if ContainerModelBackend is None:
            raise ValueError(
                "container backend requires 'requests' package. "
                "Install it with: pip install requests"
            )
        return ContainerModelBackend()
    raise ValueError(f"Unknown LOCAL_AI_BACKEND value: {backend!r}. Use 'mock' or 'container'.")
