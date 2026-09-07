import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, ReadDiagnosticEventArgs } from "@/api/schemas";
import {
  createReadDiagnosticRequestId,
  getReadStateDiagnosticsRingForTests,
  recordAutoMarkCancelled,
  recordAutoMarkDispatched,
  recordAutoMarkPendingSlow,
  recordAutoMarkScheduled,
  recordAutoMarkSettled,
  recordAutoMarkSkipped,
  resetReadStateDiagnosticsForTests,
  setReadStateDiagnosticsTransportForTests,
} from "@/components/reader/hooks/article/read-state-diagnostics";

type SentBatch = readonly ReadDiagnosticEventArgs[];

function createFakeTransport() {
  const calls: SentBatch[] = [];
  let outcome: "success" | "failure" = "success";
  const transport = (events: SentBatch) => {
    calls.push(events);
    return Promise.resolve(outcome === "success" ? Result.succeed(null) : Result.fail({} as AppError));
  };
  return {
    transport,
    calls,
    failNext: () => {
      outcome = "failure";
    },
  };
}

describe("read-state-diagnostics sink", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetReadStateDiagnosticsForTests();
  });

  afterEach(() => {
    resetReadStateDiagnosticsForTests();
    vi.useRealTimers();
  });

  it("generates unique opaque request ids that do not embed any input", () => {
    const a = createReadDiagnosticRequestId();
    const b = createReadDiagnosticRequestId();

    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("flushes the first event immediately and sends the scheduled shape", async () => {
    const { transport, calls } = createFakeTransport();
    setReadStateDiagnosticsTransportForTests(transport);

    recordAutoMarkScheduled("req-1", 1, 300);
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toEqual([[{ event: "scheduled", requestId: "req-1", generation: 1, delayMs: 300 }]]);
    expect(getReadStateDiagnosticsRingForTests()).toEqual([]);
  });

  it("throttles a second normal flush within the minimum flush interval", async () => {
    const { transport, calls } = createFakeTransport();
    setReadStateDiagnosticsTransportForTests(transport);

    recordAutoMarkScheduled("req-1", 1, 300);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);

    recordAutoMarkSkipped("req-2", 2, "already_read");
    await vi.advanceTimersByTimeAsync(0);

    // Still within the 10s throttle window: not sent yet, but retained in the ring.
    expect(calls).toHaveLength(1);
    expect(getReadStateDiagnosticsRingForTests()).toEqual([
      { event: "skipped", requestId: "req-2", generation: 2, reason: "already_read" },
    ]);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(2);
    expect(getReadStateDiagnosticsRingForTests()).toEqual([]);
  });

  it("flushes a settled failure event immediately, bypassing the throttle", async () => {
    const { transport, calls } = createFakeTransport();
    setReadStateDiagnosticsTransportForTests(transport);

    recordAutoMarkScheduled("req-1", 1, 300);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);

    recordAutoMarkSettled("req-1", 1, "failure", 42, "retryable", false);
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual([
      {
        event: "settled",
        requestId: "req-1",
        generation: 1,
        outcome: "failure",
        durationMs: 42,
        errorClass: "retryable",
        staleOwner: false,
      },
    ]);
  });

  it("flushes a pending_slow event immediately, bypassing the throttle", async () => {
    const { transport, calls } = createFakeTransport();
    setReadStateDiagnosticsTransportForTests(transport);

    recordAutoMarkScheduled("req-1", 1, 300);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);

    recordAutoMarkPendingSlow("req-1", 1, 5_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual([{ event: "pending_slow", requestId: "req-1", generation: 1, elapsedMs: 5_000 }]);
  });

  it("does not start a second send while one is already in flight", async () => {
    const calls: SentBatch[] = [];
    const resolvers: Array<() => void> = [];
    const transport = (events: SentBatch) => {
      calls.push(events);
      return new Promise<Result.Result<null, AppError>>((resolve) => {
        resolvers.push(() => resolve(Result.succeed(null)));
      });
    };
    setReadStateDiagnosticsTransportForTests(transport);

    recordAutoMarkScheduled("req-1", 1, 300);
    expect(calls).toHaveLength(1); // send started synchronously, still pending

    recordAutoMarkDispatched("req-1", 1, 5);
    await vi.advanceTimersByTimeAsync(0);

    // The second event stays queued in the ring; no second send was started.
    expect(calls).toHaveLength(1);
    expect(getReadStateDiagnosticsRingForTests()).toEqual([
      { event: "dispatched", requestId: "req-1", generation: 1, driftMs: 5 },
    ]);

    resolvers[0]?.();
    await vi.advanceTimersByTimeAsync(0);

    // Once the in-flight send settles, the periodic timer (or the next event) can flush the rest.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(2);
  });

  it("bounds the ring to at most 64 events, flushing early when full", async () => {
    const { transport, calls } = createFakeTransport();
    setReadStateDiagnosticsTransportForTests(transport);

    recordAutoMarkScheduled("req-0", 0, 300);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);

    for (let i = 0; i < 64; i += 1) {
      recordAutoMarkCancelled(`req-${i}`, i, "effect_cleanup");
    }
    await vi.advanceTimersByTimeAsync(0);

    for (const sent of calls) {
      expect(sent.length).toBeLessThanOrEqual(64);
    }
    expect(getReadStateDiagnosticsRingForTests().length).toBeLessThanOrEqual(64);
  });

  it("logs a send failure exactly once and never recurses into the diagnostics system", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { transport, calls, failNext } = createFakeTransport();
    failNext();
    setReadStateDiagnosticsTransportForTests(transport);

    recordAutoMarkScheduled("req-1", 1, 300);
    await vi.advanceTimersByTimeAsync(0);

    recordAutoMarkScheduled("req-2", 2, 300);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("stops accepting new events once the session byte budget is exhausted", async () => {
    const { transport, calls } = createFakeTransport();
    setReadStateDiagnosticsTransportForTests(transport);

    // 256 KiB session cap / ~64 bytes per scheduled event ~= 4096 events before exhaustion.
    for (let i = 0; i < 5000; i += 1) {
      recordAutoMarkScheduled(`req-${i}`, i, 300);
      await vi.advanceTimersByTimeAsync(60_000);
    }

    const totalSent = calls.reduce((sum, batch) => sum + batch.length, 0);
    expect(totalSent).toBeLessThan(5000);

    // Once exhausted, further pushes are dropped entirely rather than growing the ring.
    recordAutoMarkScheduled("req-overflow", 99_999, 300);
    expect(getReadStateDiagnosticsRingForTests()).toEqual([]);
  });

  it("never lets a diagnostics send failure throw out of the recording call", () => {
    setReadStateDiagnosticsTransportForTests(() => Promise.reject(new Error("transport exploded")));

    expect(() => recordAutoMarkScheduled("req-1", 1, 300)).not.toThrow();
  });
});
