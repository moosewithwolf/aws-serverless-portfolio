"""CLI chat harness for the Local AI Chatbot.

Accepts a message from the command line, processes it through the same
pipeline as the Lambda handler and SQS agent, and prints stable JSON
output with requestId, status, message, and sanitized fields.

Usage:
    PYTHONPATH=local_ai/harness python -m local_agent.run_chat "Your message here"
    or
    PYTHONPATH=local_ai/harness python local_agent/run_chat.py "Your message here"
"""

from __future__ import annotations

import json
import sys

from local_agent.chat_worker.model_gateway import process_message


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
    result = process_message(message)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
