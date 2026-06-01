/**
 * Chat API module for the Local AI Chatbot.
 *
 * Provides typed request/response models and HTTP operations:
 * - `postChat()` — POST a message and receive a request ID
 * - `pollChat()` — async generator that polls GET /chat/{requestId}
 *   until the status reaches a terminal state (DONE or ERROR).
 *
 * Reuses `apiBaseUrl` from `./api` so both modules target the same endpoint.
 */

import { apiBaseUrl } from "../../shared/api/portfolioApi";

// ---------------------------------------------------------------------------
// Types (mirror local_ai/harness/harness/contracts.py)
// ---------------------------------------------------------------------------

export type ChatRequest = {
  message: string;
};

export type ChatResponse = {
  requestId: string;
  status: "PENDING" | "DONE" | "ERROR";
  message?: string;
  sanitized?: boolean;
};

export type ChatStatusResponse = {
  status: "PENDING" | "DONE" | "ERROR";
  message: string;
};

// ---------------------------------------------------------------------------
// POST — Submit a chat message
// ---------------------------------------------------------------------------

// -- Runtime validation helpers (no external schema libraries) --

function isValidChatStatus(status: unknown): status is "PENDING" | "DONE" | "ERROR" {
  return typeof status === "string" && ["PENDING", "DONE", "ERROR"].includes(status);
}

function isValidChatResponse(data: unknown): data is ChatResponse {
  if (data === null || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const status = obj.status;
  if (!isValidChatStatus(status)) return false;
  if (status === "PENDING") {
    return typeof obj.requestId === "string";
  }
  // DONE / ERROR: message (if present) must be string, sanitized (if present) must be boolean
  if ("message" in obj && typeof obj.message !== "string") return false;
  if ("sanitized" in obj && typeof obj.sanitized !== "boolean") return false;
  return true;
}

function isValidChatStatusResponse(data: unknown): data is ChatStatusResponse {
  if (data === null || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const status = obj.status;
  if (!isValidChatStatus(status)) return false;
  return typeof obj.message === "string";
}

/**
 * POST /chat — submits a message and returns the initial response
 * (usually with status "PENDING" and a requestId for polling).
 */
export async function postChat(message: string, signal?: AbortSignal): Promise<ChatResponse> {
  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat POST failed: ${response.status}`);
  }

  const data = await response.json();

  if (!isValidChatResponse(data)) {
    throw new Error("Invalid chat response");
  }

  return data as ChatResponse;
}

// ---------------------------------------------------------------------------
// GET polling — async generator
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;
const TERMINAL_STATUSES = new Set(["DONE", "ERROR"]);

/**
 * Error thrown when the polling limit is reached (agent offline / timed out).
 */
export class PollTimeoutError extends Error {
  constructor() {
    super("Local agent is offline or timed out.");
    this.name = "PollTimeoutError";
  }
}

/**
 * Async generator that polls GET /chat/{requestId} until the status
 * reaches a terminal state (DONE or ERROR) or the max attempt count
 * is reached.
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
export async function* pollChat(
  requestId: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatStatusResponse> {
  let attempt = 0;

  while (attempt < MAX_POLL_ATTEMPTS) {
    if (signal?.aborted) {
      return;
    }

    attempt++;

    const response = await fetch(`${apiBaseUrl}/chat/${requestId}`, { signal });

    if (!response.ok) {
      // If the request is not found, it may still be processing
      if (response.status === 404) {
        await delay(POLL_INTERVAL_MS, signal);
        continue;
      }
      throw new Error(`Chat poll failed: ${response.status}`);
    }

    const data = await response.json();

    if (!isValidChatStatusResponse(data)) {
      throw new Error("Invalid chat status response");
    }

    const update: ChatStatusResponse = data as ChatStatusResponse;
    yield update;

    if (TERMINAL_STATUSES.has(update.status)) {
      return;
    }

    await delay(POLL_INTERVAL_MS, signal);
  }

  throw new PollTimeoutError();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(cleanupAndResolve, ms);

    function cleanupAndResolve() {
      signal?.removeEventListener("abort", cleanupAndResolve);
      window.clearTimeout(timeoutId);
      resolve();
    }

    signal?.addEventListener("abort", cleanupAndResolve, { once: true });
  });
}
