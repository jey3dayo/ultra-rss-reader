import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, ReadDiagnosticEventArgs } from "@/api/schemas";
import {
  createReadDiagnosticRequestId,
  getReadStateDiagnosticsDroppedCountForTests,
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
type SentCall = { events: SentBatch; droppedCount: number };

function createFakeTransport() {
  const calls: SentCall[] = [];
  let outcome: "success" | "failure" = "success";
  const transport = (events: SentBatch, droppedCount: number) => {
    calls.push({ events, droppedCount });
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

    expect(calls).toEqual([
      { events: [{ event: "scheduled", requestId: "req-1", generation: 1, delayMs: 300 }], droppedCount: 0 },
    ]);
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
    expect(calls[1]).toEqual({
      events: [
        {
          event: "settled",
          requestId: "req-1",
          generation: 1,
          outcome: "failure",
          durationMs: 42,
          saturated: false,
          errorClass: "retryable",
          staleOwner: false,
        },
      ],
      droppedCount: 0,
    });
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
    expect(calls[1]).toEqual({
      events: [{ event: "pending_slow", requestId: "req-1", generation: 1, elapsedMs: 5_000, saturated: false }],
      droppedCount: 0,
    });
  });

  it("does not start a second send while one is already in flight", async () => {
    const calls: SentCall[] = [];
    const resolvers: Array<() => void> = [];
    const transport = (events: SentBatch, droppedCount: number) => {
      calls.push({ events, droppedCount });
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
      { event: "dispatched", requestId: "req-1", generation: 1, driftMs: 5, saturated: false },
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
      expect(sent.events.length).toBeLessThanOrEqual(64);
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

    const totalSent = calls.reduce((sum, call) => sum + call.events.length, 0);
    expect(totalSent).toBeLessThan(5000);

    // Once exhausted, further pushes are dropped entirely rather than growing the ring.
    recordAutoMarkScheduled("req-overflow", 99_999, 300);
    expect(getReadStateDiagnosticsRingForTests()).toEqual([]);
  });

  it("never lets an async diagnostics send failure throw out of the recording call", () => {
    setReadStateDiagnosticsTransportForTests(() => Promise.reject(new Error("transport exploded")));

    expect(() => recordAutoMarkScheduled("req-1", 1, 300)).not.toThrow();
  });

  it("never lets a synchronous transport throw escape, and still cleans up sending state", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setReadStateDiagnosticsTransportForTests(() => {
      throw new Error("transport threw synchronously instead of returning a promise");
    });

    expect(() => recordAutoMarkScheduled("req-1", 1, 300)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // sending must have been released even though the transport never returned a promise: a
    // second, working transport should still be able to send afterwards.
    const { transport, calls } = createFakeTransport();
    setReadStateDiagnosticsTransportForTests(transport);
    recordAutoMarkScheduled("req-2", 2, 300);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls.length).toBeGreaterThan(0);
    warnSpy.mockRestore();
  });

  describe("point A: saturation and non-finite values", () => {
    it("saturates an out-of-range positive drift and flags it, without inventing the real value", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkScheduled("req-0", 0, 300);
      await vi.advanceTimersByTimeAsync(0);

      recordAutoMarkDispatched("req-1", 1, 999_999); // e.g. after a long system sleep/resume
      await vi.advanceTimersByTimeAsync(60_000);

      const dispatched = calls.at(-1)?.events[0];
      expect(dispatched).toEqual({
        event: "dispatched",
        requestId: "req-1",
        generation: 1,
        driftMs: 60_000,
        saturated: true,
      });
    });

    it("saturates an out-of-range negative drift and flags it", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkScheduled("req-0", 0, 300);
      await vi.advanceTimersByTimeAsync(0);

      recordAutoMarkDispatched("req-1", 1, -999_999);
      await vi.advanceTimersByTimeAsync(60_000);

      const dispatched = calls.at(-1)?.events[0];
      expect(dispatched).toEqual({
        event: "dispatched",
        requestId: "req-1",
        generation: 1,
        driftMs: -60_000,
        saturated: true,
      });
    });

    it("does not mark an in-range drift as saturated", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkDispatched("req-1", 1, 12);
      await vi.advanceTimersByTimeAsync(0);

      expect(calls[0]?.events[0]).toMatchObject({ driftMs: 12, saturated: false });
    });

    it("saturates an out-of-range duration on a settled event, exactly at the bound", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkSettled("req-1", 1, "success", 999_999_999, undefined, false);
      await vi.advanceTimersByTimeAsync(0);

      expect(calls[0]?.events[0]).toEqual({
        event: "settled",
        requestId: "req-1",
        generation: 1,
        outcome: "success",
        durationMs: 60_000,
        saturated: true,
        errorClass: undefined,
        staleOwner: false,
      });
    });

    it("does not flag exactly-at-bound values as saturated", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkSettled("req-1", 1, "success", 60_000, undefined, false);
      await vi.advanceTimersByTimeAsync(0);

      expect(calls[0]?.events[0]).toMatchObject({ durationMs: 60_000, saturated: false });
    });

    it("saturates an out-of-range elapsed_ms on a pending_slow event", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkPendingSlow("req-1", 1, 700_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(calls[0]?.events[0]).toEqual({
        event: "pending_slow",
        requestId: "req-1",
        generation: 1,
        elapsedMs: 600_000,
        saturated: true,
      });
    });

    it("drops (never sends) a non-finite duration and counts it, without dropping other events in the same batch", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkSettled("req-nan", 1, "success", Number.NaN, undefined, false);
      recordAutoMarkScheduled("req-ok", 2, 300);
      await vi.advanceTimersByTimeAsync(0);

      expect(calls).toHaveLength(1);
      expect(calls[0]?.events).toEqual([{ event: "scheduled", requestId: "req-ok", generation: 2, delayMs: 300 }]);
      expect(calls[0]?.droppedCount).toBe(1);
    });

    it("drops a non-finite drift (Infinity) and counts it", async () => {
      setReadStateDiagnosticsTransportForTests(() => Promise.resolve(Result.succeed(null)));

      recordAutoMarkDispatched("req-1", 1, Number.POSITIVE_INFINITY);

      expect(getReadStateDiagnosticsRingForTests()).toEqual([]);
      expect(getReadStateDiagnosticsDroppedCountForTests()).toBe(1);
    });

    it("drops a non-finite elapsed (-Infinity) and counts it", async () => {
      setReadStateDiagnosticsTransportForTests(() => Promise.resolve(Result.succeed(null)));

      recordAutoMarkPendingSlow("req-1", 1, Number.NEGATIVE_INFINITY);

      expect(getReadStateDiagnosticsRingForTests()).toEqual([]);
      expect(getReadStateDiagnosticsDroppedCountForTests()).toBe(1);
    });
  });

  describe("point B: bounded ring while a send is in flight, FIFO eviction, and drop accounting", () => {
    it("stays bounded to 64 events even while more than 64 arrive during an in-flight send", async () => {
      const calls: SentCall[] = [];
      let resolveFirst: (() => void) | undefined;
      const transport = (events: SentBatch, droppedCount: number) => {
        calls.push({ events, droppedCount });
        if (resolveFirst === undefined) {
          return new Promise<Result.Result<null, AppError>>((resolve) => {
            resolveFirst = () => resolve(Result.succeed(null));
          });
        }
        return Promise.resolve(Result.succeed(null));
      };
      setReadStateDiagnosticsTransportForTests(transport);

      // Starts a send that never resolves until we tell it to.
      recordAutoMarkScheduled("req-start", 0, 300);
      expect(calls).toHaveLength(1);

      // Push well over the 64-event cap while that send is still in flight.
      for (let i = 0; i < 100; i += 1) {
        recordAutoMarkCancelled(`req-${i}`, i, "effect_cleanup");
        // The ring must never exceed the cap at any point, not just eventually.
        expect(getReadStateDiagnosticsRingForTests().length).toBeLessThanOrEqual(64);
      }
      expect(getReadStateDiagnosticsRingForTests().length).toBe(64);
      // The 36 that could not fit (100 - 64) were evicted oldest-first and counted, not silently
      // lost without a trace.
      expect(getReadStateDiagnosticsDroppedCountForTests()).toBe(36);

      // The surviving ring holds the newest 64 (req-36 .. req-99): the oldest pushed (req-0..35)
      // were the ones evicted.
      const ring = getReadStateDiagnosticsRingForTests();
      expect(ring[0]).toMatchObject({ requestId: "req-36" });
      expect(ring.at(-1)).toMatchObject({ requestId: "req-99" });

      resolveFirst?.();
      await vi.advanceTimersByTimeAsync(0);

      // Once the in-flight send settles, the backlog is scheduled (not sent again immediately
      // without limit) at the next permitted time.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const secondCall = calls[1];
      expect(secondCall?.events.length).toBeLessThanOrEqual(64);
      expect(secondCall?.droppedCount).toBe(36);
    });

    it("drops a single event that alone exceeds the batch byte cap, without touching the rest of the ring", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      // The very first push always flushes immediately (nothing to throttle against yet), so
      // consume that opportunity first, leaving req-ok genuinely pending in the ring below.
      recordAutoMarkScheduled("req-flushed-first", 0, 300);
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toHaveLength(1);

      recordAutoMarkScheduled("req-ok", 1, 300);
      // A request id this long cannot occur from a real crypto.randomUUID() generator, but the
      // sink itself does not validate charset/length (the wire schema does); this simulates a
      // single pathologically oversized event to exercise the "too large to ever fit" path.
      const hugeRequestId = "x".repeat(20_000);
      recordAutoMarkCancelled(hugeRequestId, 2, "effect_cleanup");

      expect(getReadStateDiagnosticsDroppedCountForTests()).toBe(1);
      const ring = getReadStateDiagnosticsRingForTests();
      expect(ring).toHaveLength(1);
      expect(ring[0]).toMatchObject({ requestId: "req-ok" });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls[1]).toEqual({
        events: [{ event: "scheduled", requestId: "req-ok", generation: 1, delayMs: 300 }],
        droppedCount: 1,
      });
    });

    it("resets the dropped count after it is handed off to a batch", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkSettled("req-nan", 1, "success", Number.NaN, undefined, false);
      recordAutoMarkScheduled("req-ok", 2, 300);
      await vi.advanceTimersByTimeAsync(0);
      expect(calls[0]?.droppedCount).toBe(1);
      expect(getReadStateDiagnosticsDroppedCountForTests()).toBe(0);

      recordAutoMarkScheduled("req-ok-2", 3, 300);
      await vi.advanceTimersByTimeAsync(60_000);
      // The second batch must not repeat the already-reported drop.
      expect(calls.at(-1)?.droppedCount).toBe(0);
    });

    it("can send a batch carrying only a dropped count with no surviving events", async () => {
      const { transport, calls } = createFakeTransport();
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkSettled("req-nan", 1, "success", Number.NaN, undefined, false);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ events: [], droppedCount: 1 });
    });

    it("schedules (does not send instantly) a post-send backlog flush, respecting the normal throttle", async () => {
      const calls: SentCall[] = [];
      let resolveFirst: (() => void) | undefined;
      const transport = (events: SentBatch, droppedCount: number) => {
        calls.push({ events, droppedCount });
        if (resolveFirst === undefined) {
          return new Promise<Result.Result<null, AppError>>((resolve) => {
            resolveFirst = () => resolve(Result.succeed(null));
          });
        }
        return Promise.resolve(Result.succeed(null));
      };
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkScheduled("req-1", 1, 300); // starts the never-resolving send
      recordAutoMarkSkipped("req-2", 2, "already_read"); // queued behind it, non-immediate

      resolveFirst?.();
      await vi.advanceTimersByTimeAsync(0);
      // Immediately after the first send settles, the normal (non-immediate) backlog must not
      // have gone out yet -- it is scheduled for the earliest permitted time, not sent on the
      // spot.
      expect(calls).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls).toHaveLength(2);
    });

    it("still flushes urgent (failure/pending_slow) backlog promptly after the in-flight send settles", async () => {
      const calls: SentCall[] = [];
      let resolveFirst: (() => void) | undefined;
      const transport = (events: SentBatch, droppedCount: number) => {
        calls.push({ events, droppedCount });
        if (resolveFirst === undefined) {
          return new Promise<Result.Result<null, AppError>>((resolve) => {
            resolveFirst = () => resolve(Result.succeed(null));
          });
        }
        return Promise.resolve(Result.succeed(null));
      };
      setReadStateDiagnosticsTransportForTests(transport);

      recordAutoMarkScheduled("req-1", 1, 300); // starts the never-resolving send
      recordAutoMarkPendingSlow("req-2", 2, 5_000); // urgent, queued behind the in-flight send

      resolveFirst?.();
      await vi.advanceTimersByTimeAsync(0);

      // The queued urgent event goes out right after the in-flight send settles, without waiting
      // for the normal 10s cadence.
      expect(calls).toHaveLength(2);
      expect(calls[1]?.events).toEqual([
        { event: "pending_slow", requestId: "req-2", generation: 2, elapsedMs: 5_000, saturated: false },
      ]);
    });
  });
});
