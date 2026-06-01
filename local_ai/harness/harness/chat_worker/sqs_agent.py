"""MacBook polling agent for the Local AI Chatbot harness.

Reads chat-job messages from an SQS queue, processes each through the
model gateway, and writes the result back to DynamoDB before deleting
the SQS message.

Run once::
    PYTHONPATH=local_ai/harness python -m harness.chat_worker.sqs_agent --once

Loop continuously (default)::
    PYTHONPATH=local_ai/harness python -m harness.chat_worker.sqs_agent
"""

from __future__ import annotations

import argparse
import json
import logging
import time
import signal
from typing import Optional

# ---------------------------------------------------------------------------
# Lazy boto3 imports — tests can patch these without AWS SDK at import time
# ---------------------------------------------------------------------------
try:
    import boto3  # noqa: F401
except ImportError:
    boto3 = None  # type: ignore[assignment]

import os

from harness.chat_worker.model_gateway import process_message
from harness.shared.contracts import ChatStatus

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SQS_POLL_WAIT: int = 5           # long-poll seconds
SQS_VISIBILITY_TIMEOUT: int = 60 # seconds before failed work becomes visible again
SQS_BATCH_SIZE: int = 5
POLL_INTERVAL: int = 2           # seconds between poll cycles in loop mode
MESSAGE_TIMEOUT: int = 45        # hard cap for one model job

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# ---------------------------------------------------------------------------
# Lazy AWS resource helpers (mirrors app.py pattern)
# ---------------------------------------------------------------------------

def _chat_queue_url() -> str:
    return os.environ.get("CHAT_QUEUE_URL", "")


def _chat_table_name() -> str:
    return os.environ.get("CHAT_REQUEST_TABLE", "")


def _now_epoch() -> int:
    return int(time.time())


def _sqs_resource():
    return boto3.resource("sqs", region_name=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"))


def _ddb_resource():
    return boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"))


# ---------------------------------------------------------------------------
# Core processing
# ---------------------------------------------------------------------------

def _handle_message(body: str, table_name: str) -> bool:
    """Process a single SQS message body and return True on full success.

    Returns True if the message was processed successfully and is safe to delete.
    Returns False if the message should be left for retry.

    Note: SQS deletion is handled by the caller (poll_once), which owns the
    receipt_handle and calls _delete_sqs_message exactly once.
    """
    # Parse body
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Invalid JSON body, skipping: %s", exc)
        return False

    # Extract and validate fields
    request_id: Optional[str] = data.get("requestId")
    message: Optional[str] = data.get("message")

    if not request_id or not isinstance(request_id, str):
        logger.warning("Message missing requestId, skipping (fail closed).")
        return False

    if not message or not isinstance(message, str):
        # requestId exists → we can safely record an error
        logger.warning(
            "Message missing 'message' field for requestId=%s, recording ERROR.",
            request_id,
        )
        if not _update_dynamodb_error(table_name, request_id, "Message payload missing required 'message' field."):
            logger.error(
                "Failed to write ERROR for missing message, requestId=%s — leaving for retry.",
                request_id,
            )
            return False
        return True

    logger.info("Processing chat request requestId=%s", request_id)

    # Process through model gateway
    result = process_message(message, request_id=request_id)
    status = result.get("status", ChatStatus.ERROR.value)
    response_message = result.get("message", "")
    sanitized = result.get("sanitized", False)

    # Write result to DynamoDB
    ddb_ok = _update_dynamodb(
        table_name, request_id, status, response_message, sanitized
    )
    if not ddb_ok:
        logger.error(
            "DynamoDB update failed for requestId=%s — leaving message for retry.",
            request_id,
        )
        return False

    logger.info("Completed chat request requestId=%s status=%s", request_id, status)

    # DynamoDB succeeded — return True so poll_once deletes with actual ReceiptHandle
    return True


def _request_id_from_body(body: str) -> Optional[str]:
    """Best-effort requestId extraction for timeout/error handling."""
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, TypeError):
        return None
    request_id = data.get("requestId")
    return request_id if isinstance(request_id, str) and request_id else None


def _handle_message_with_timeout(body: str, table_name: str) -> bool:
    """Process one message with a hard timeout so one job cannot stall the agent."""
    def _raise_timeout(_signum, _frame):
        raise TimeoutError("Chat message processing timed out.")

    previous_handler = signal.signal(signal.SIGALRM, _raise_timeout)
    signal.alarm(MESSAGE_TIMEOUT)
    try:
        return _handle_message(body, table_name)
    except TimeoutError as exc:
        request_id = _request_id_from_body(body)
        logger.error("Message processing timed out requestId=%s: %s", request_id, exc)
        if request_id:
            return _update_dynamodb_error(
                table_name,
                request_id,
                "The local model timed out. Please try again.",
            )
        return False
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous_handler)


def _update_dynamodb(
    table_name: str,
    request_id: str,
    status: str,
    response_message: str,
    sanitized: bool,
) -> bool:
    """Update DynamoDB with the processing result."""
    if not table_name:
        logger.error("CHAT_REQUEST_TABLE not configured.")
        return False

    try:
        ddb = _ddb_resource()
        table = ddb.Table(table_name)
        table.update_item(
            Key={"requestId": request_id},
            UpdateExpression=(
                "SET #st = :st, #msg = :msg, #san = :san, #ut = :ut"
            ),
            ExpressionAttributeNames={
                "#st": "status",
                "#msg": "message",
                "#san": "sanitized",
                "#ut": "updatedAt",
            },
            ExpressionAttributeValues={
                ":st": status,
                ":msg": response_message,
                ":san": sanitized,
                ":ut": _now_epoch(),
            },
            ConditionExpression="attribute_exists(requestId)",
        )
        return True
    except Exception as exc:
        logger.error("DynamoDB update error for %s: %s", request_id, exc)
        return False


def _update_dynamodb_error(
    table_name: str, request_id: str, reason: str
) -> bool:
    """Write an ERROR status to DynamoDB (used for invalid payloads with requestId)."""
    return _update_dynamodb(
        table_name,
        request_id,
        ChatStatus.ERROR.value,
        reason,
        False,
    )


def _delete_sqs_message(queue_url: str, receipt_handle: str) -> bool:
    """Delete a message from SQS using its receipt handle."""
    if not queue_url:
        logger.error("CHAT_QUEUE_URL not configured.")
        return False

    try:
        sqs = _sqs_resource()
        queue = sqs.Queue(queue_url)
        delete_message = getattr(queue, "delete_message", None)
        if callable(delete_message):
            delete_message(ReceiptHandle=receipt_handle)
        else:
            queue.meta.client.delete_message(
                QueueUrl=queue_url,
                ReceiptHandle=receipt_handle,
            )
        logger.info("Deleted SQS message.")
        return True
    except Exception as exc:
        logger.error("SQS delete error: %s", exc)
        return False


def _receive_sqs_messages(queue) -> dict:
    """Receive SQS messages from either a real boto3 Queue or a test double."""
    receive_message = getattr(queue, "receive_message", None)
    if callable(receive_message):
        return receive_message(
            MaxNumberOfMessages=SQS_BATCH_SIZE,
            WaitTimeSeconds=SQS_POLL_WAIT,
            VisibilityTimeout=SQS_VISIBILITY_TIMEOUT,
        )

    messages = queue.receive_messages(
        MaxNumberOfMessages=SQS_BATCH_SIZE,
        WaitTimeSeconds=SQS_POLL_WAIT,
        VisibilityTimeout=SQS_VISIBILITY_TIMEOUT,
    )
    return {
        "Messages": [
            {
                "Body": message.body,
                "ReceiptHandle": message.receipt_handle,
            }
            for message in messages
        ]
    }


# ---------------------------------------------------------------------------
# Polling loop
# ---------------------------------------------------------------------------

def poll_once(table_name: str, queue_url: str) -> None:
    """Poll SQS once, process all received messages, exit."""
    try:
        sqs = _sqs_resource()
        queue = sqs.Queue(queue_url)
    except Exception as exc:
        logger.error("Failed to get SQS queue: %s", exc)
        return

    messages = _receive_sqs_messages(queue)
    logger.info("Received %s SQS message(s).", len(messages.get("Messages", [])))

    for msg in messages.get("Messages", []):
        body = msg.get("Body", "")
        receipt_handle = msg.get("ReceiptHandle", "")
        if not receipt_handle:
            continue

        try:
            success = _handle_message_with_timeout(body, table_name)
        except Exception as exc:
            logger.error("Unhandled error processing message: %s", exc)
            success = False

        # Delete only on success
        if success and receipt_handle:
            try:
                _delete_sqs_message(queue_url, receipt_handle)
            except Exception:
                pass


def run_loop(table_name: str, queue_url: str, once: bool = False) -> None:
    """Poll SQS in a loop, or once if *once* is True."""
    logger.info("Starting agent — table=%s queue=%s once=%s", table_name, queue_url, once)

    if once:
        poll_once(table_name, queue_url)
        return

    while True:
        try:
            poll_once(table_name, queue_url)
        except Exception as exc:
            logger.error("Poll cycle error: %s", exc)
        time.sleep(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """CLI entry point for the polling agent."""
    parser = argparse.ArgumentParser(description="SQS polling agent for chat jobs.")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Poll once and exit instead of looping.",
    )
    args = parser.parse_args()

    table_name = _chat_table_name()
    queue_url = _chat_queue_url()

    if not table_name:
        print("ERROR: CHAT_REQUEST_TABLE not set in environment", flush=True)
        raise SystemExit(1)
    if not queue_url:
        print("ERROR: CHAT_QUEUE_URL not set in environment", flush=True)
        raise SystemExit(1)

    run_loop(table_name, queue_url, once=args.once)


if __name__ == "__main__":
    main()
