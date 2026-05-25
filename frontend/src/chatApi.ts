/**
 * Chat API module for the Local AI Chatbot.
 *
 * Provides typed request/response models and HTTP operations:
 * - `postChat()` — POST a message and receive a request ID
 * - `pollChat()` — async generator that polls GET /chat/{requestId}
 *   until the status reaches a terminal state (DONE or FAILED).
 *
 * Reuses `apiBaseUrl` from `./api` so both modules target the same endpoint.
 */

import { apiBaseUrl } from "./api";

// ---------------------------------------------------------------------------
// Types (mirror local_ai/harness/harness/contracts.py)
// ---------------------------------------------------------------------------

export type ChatRequest = {
  message: string;
};

export type ChatResponse = {
  requestId: string;
  status: "PENDING" | "DONE" | "FAILED";
  message: string;
  sanitized: boolean;
};

export type ChatStatusResponse = {
  status: "PENDING" | "DONE" | "FAILED";
  message: string;
};

// ---------------------------------------------------------------------------
// POST — Submit a chat message
// ---------------------------------------------------------------------------

/**
 * POST /chat — submits a message and returns the initial response
 * (usually with status "PENDING" and a requestId for polling).
 */
export async function postChat(message: string): Promise<ChatResponse> {
  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Chat POST failed: ${response.status}`);
  }

  return (await response.json()) as ChatResponse;
}

// ---------------------------------------------------------------------------
// GET polling — async generator
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["DONE", "FAILED"]);

/**
 * Async generator that polls GET /chat/{requestId} until the status
 * reaches a terminal state (DONE or FAILED).
 *
 * Yields each `ChatStatusResponse` as it arrives.
 *
 * @example
 * ```ts
 * const initial = await postChat("Tell me about AWS");
 * for await (const update of pollChat(initial.requestId)) {
 *   console.log(update.status); // "PENDING" → "DONE"
 * }
 * ```
 */
export async function* pollChat(requestId: string): AsyncGenerator<ChatStatusResponse> {
  while (true) {
    const response = await fetch(`${apiBaseUrl}/chat/${requestId}`);

    if (!response.ok) {
      // If the request is not found, it may still be processing
      if (response.status === 404) {
        await delay(POLL_INTERVAL_MS);
        continue;
      }
      throw new Error(`Chat poll failed: ${response.status}`);
    }

    const update: ChatStatusResponse = await response.json();
    yield update;

    if (TERMINAL_STATUSES.has(update.status)) {
      break;
    }

    await delay(POLL_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
