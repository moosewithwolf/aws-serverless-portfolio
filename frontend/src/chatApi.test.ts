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

import { PollTimeoutError, pollChat } from "./chatApi";

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
