"""Local AI Chatbot Harness — init module.

Exposes the harness package entry point so the Lambda handler
(`app.py`) can import submodules cleanly.
"""

from harness import contracts  # noqa: F401 — expose contract models
from harness.mock_backend import MockModelBackend  # noqa: F401
from harness.safety import validate_safety  # noqa: F401
from harness.prompt_builder import load_context  # noqa: F401
