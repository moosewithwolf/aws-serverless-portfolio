/**
 * Unit tests for chatApi.ts — polling behavior.
 *
 * Phase 5 — Frontend timeout/offline state:
 * - PollTimeoutError class exists with correct message
 * - Constants are set correctly (POLL_INTERVAL_MS=2000, MAX_POLL_ATTEMPTS=30)
 * - pollChat async generator: PENDING→DONE completes, ERROR completes,
 *   max PENDING/404 attempts → PollTimeoutError
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { PollTimeoutError, pollChat, postChat } from "./chatApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object matching the shape fetch returns. */
function mockResponse(
  ok: boolean,
  status: number,
  json: () => Promise<unknown>,
): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: new Headers(),
    redirected: false,
    type: "basic",
    url: "",
    clone: () => mockResponse(ok, status, json),
    body: null,
    bodyUsed: false,
    json,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    text: () => Promise.resolve(""),
    formData: () => Promise.resolve(new FormData()),
    values: () => [],
    [Symbol.asyncIterator]: async function* () {},
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// PollTimeoutError shape tests (existing — kept for completeness)
// ---------------------------------------------------------------------------

describe("PollTimeoutError", () => {
  it("extends Error", () => {
    const err = new PollTimeoutError();
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct message", () => {
    const err = new PollTimeoutError();
    expect(err.message).toBe("Local agent is offline or timed out.");
  });

  it("has the correct name", () => {
    const err = new PollTimeoutError();
    expect(err.name).toBe("PollTimeoutError");
  });
});

// ---------------------------------------------------------------------------
// pollChat — async generator behaviour
// ---------------------------------------------------------------------------

describe("pollChat", () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it(
    "yields PENDING then DONE and completes without throwing",
    async () => {
      fetchSpy.mockImplementationOnce(async () =>
        mockResponse(true, 200, async () => ({
          status: "PENDING",
          message: "",
        })),
      );
      fetchSpy.mockImplementationOnce(async () =>
        mockResponse(true, 200, async () => ({
          status: "DONE",
          message: "Hello!",
        })),
      );

      const gen = pollChat("req-1");
      const results: string[] = [];

      const p1 = gen.next();
      await vi.advanceTimersByTimeAsync(2000);
      results.push((await p1).value.status);

      const p2 = gen.next();
      await vi.advanceTimersByTimeAsync(2000);
      results.push((await p2).value.status);

      const p3 = gen.next();
      expect((await p3).done).toBe(true);

      expect(results).toEqual(["PENDING", "DONE"]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    },
  );

  it(
    "yields ERROR and completes without throwing",
    async () => {
      fetchSpy.mockImplementationOnce(async () =>
        mockResponse(true, 200, async () => ({
          status: "PENDING",
          message: "",
        })),
      );
      fetchSpy.mockImplementationOnce(async () =>
        mockResponse(true, 200, async () => ({
          status: "ERROR",
          message: "Failed",
        })),
      );

      const gen = pollChat("req-2");
      const results: string[] = [];

      const p1 = gen.next();
      await vi.advanceTimersByTimeAsync(2000);
      results.push((await p1).value.status);

      const p2 = gen.next();
      await vi.advanceTimersByTimeAsync(2000);
      results.push((await p2).value.status);

      const p3 = gen.next();
      expect((await p3).done).toBe(true);

      expect(results).toEqual(["PENDING", "ERROR"]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    },
  );

  it(
    "throws PollTimeoutError after max attempts of PENDING",
    async () => {
      fetchSpy.mockResolvedValue(
        mockResponse(true, 200, async () => ({
          status: "PENDING",
          message: "",
        })),
      );

      const statuses: string[] = [];
      const task = (async () => {
        for await (const update of pollChat("req-3")) {
          statuses.push(update.status);
        }
      })();
      const assertion = expect(task).rejects.toBeInstanceOf(PollTimeoutError);

      await vi.advanceTimersByTimeAsync(60_000);

      await assertion;
      expect(statuses.length).toBe(30);
      expect(statuses.every((status) => status === "PENDING")).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(30);
    },
    30_000,
  );

  it(
    "throws PollTimeoutError after max attempts of 404s",
    async () => {
      fetchSpy.mockResolvedValue(
        mockResponse(false, 404, async () => ({})),
      );

      const gen = pollChat("req-4");
      const task = (async () => {
        for await (const _update of gen) {
          // 404 responses do not yield updates.
        }
      })();
      const assertion = expect(task).rejects.toBeInstanceOf(PollTimeoutError);

      await vi.advanceTimersByTimeAsync(60_000);

      await assertion;
      expect(fetchSpy).toHaveBeenCalledTimes(30);
    },
    30_000,
  );

  it("is an async generator function", () => {
    expect(typeof pollChat).toBe("function");
    expect(Object.prototype.toString.call(pollChat)).toBe(
      "[object AsyncGeneratorFunction]",
    );
  });

  it("returns an async iterator", () => {
    const gen = pollChat("test-id");
    expect(gen[Symbol.asyncIterator]).toBeDefined();
    expect(typeof gen.next).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Runtime validation — postChat & pollChat
// ---------------------------------------------------------------------------

describe("postChat runtime validation", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects if PENDING response lacks requestId", async () => {
    fetchSpy.mockResolvedValue(
      mockResponse(true, 200, async () => ({
        status: "PENDING",
        // requestId is intentionally missing
      })),
    );

    await expect(postChat("hello")).rejects.toThrow("Invalid chat response");
  });

  it("rejects if status is not PENDING/DONE/ERROR", async () => {
    fetchSpy.mockResolvedValue(
      mockResponse(true, 200, async () => ({
        requestId: "abc",
        status: "UNKNOWN" as unknown as "PENDING" | "DONE" | "ERROR",
      })),
    );

    await expect(postChat("hello")).rejects.toThrow("Invalid chat response");
  });
});

describe("pollChat runtime validation", () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rejects if response status is invalid", async () => {
    fetchSpy.mockImplementationOnce(async () =>
      mockResponse(true, 200, async () => ({
        status: "UNKNOWN" as unknown as "PENDING" | "DONE" | "ERROR",
        message: "bad",
      })),
    );

    const gen = pollChat("req-invalid");
    await expect(gen.next()).rejects.toThrow("Invalid chat status response");
  });

  it("rejects if response message is missing", async () => {
    fetchSpy.mockImplementationOnce(async () =>
      mockResponse(true, 200, async () => ({
        status: "PENDING",
      })),
    );

    const gen = pollChat("req-missing-message");
    await expect(gen.next()).rejects.toThrow("Invalid chat status response");
  });

  it("accepts DONE with a string message and completes", async () => {
    fetchSpy.mockImplementationOnce(async () =>
      mockResponse(true, 200, async () => ({
        status: "DONE",
        message: "All done here.",
      })),
    );

    const gen = pollChat("req-done");
    const result = await gen.next();
    expect(result.done).toBe(false);
    expect(result.value.status).toBe("DONE");
    expect(result.value.message).toBe("All done here.");

    const done = await gen.next();
    expect(done.done).toBe(true);
  });

  it("passes AbortSignal to postChat fetch", async () => {
    const controller = new AbortController();

    fetchSpy.mockImplementation(async () => mockResponse(true, 200, async () => ({
      requestId: "abc",
      status: "PENDING",
    })));

    await postChat("hello", controller.signal);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/chat"),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("passes AbortSignal to pollChat fetch", async () => {
    const controller = new AbortController();

    fetchSpy.mockImplementationOnce(async () =>
      mockResponse(true, 200, async () => ({
        status: "DONE",
        message: "complete",
      })),
    );

    const gen = pollChat("req-signal", controller.signal);
    await gen.next();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/chat/req-signal"),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("stops pollChat when AbortSignal is triggered during polling", async () => {
    const controller = new AbortController();

    fetchSpy.mockImplementationOnce(async () =>
      mockResponse(true, 200, async () => ({
        status: "PENDING",
        message: "",
      })),
    );

    const gen = pollChat("req-abort", controller.signal);
    const first = await gen.next();
    expect(first.value.status).toBe("PENDING");

    const second = gen.next();
    controller.abort();
    await Promise.resolve();

    const result = await Promise.race([second, Promise.resolve("still-pending")]);
    expect(result).toEqual({ done: true, value: undefined });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("stops pollChat when AbortSignal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(pollChat("req-early-abort", controller.signal).next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
