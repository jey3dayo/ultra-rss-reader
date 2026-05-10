import { describe, expect, it, vi } from "vitest";
import { flushMacrotask, flushMicrotasks, flushMicrotasksAndRealTimer, flushRaf } from "./async-flush";

describe("async flush helpers", () => {
  it("flushes microtasks without running timers", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];

    void Promise.resolve().then(() => calls.push("microtask"));
    setTimeout(() => calls.push("timer"), 0);

    await flushMicrotasks();

    expect(calls).toEqual(["microtask"]);
    vi.useRealTimers();
  });

  it("flushes a macrotask", async () => {
    const calls: string[] = [];

    setTimeout(() => calls.push("timer"), 0);
    await flushMacrotask();

    expect(calls).toEqual(["timer"]);
  });

  it("advances fake timers for macrotask flushes", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];

    setTimeout(() => calls.push("timer"), 0);

    await flushMacrotask();

    expect(calls).toEqual(["timer"]);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("flushes requestAnimationFrame callbacks", async () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const calls: string[] = [];
    const flushed = flushRaf().then(() => calls.push("raf"));

    expect(calls).toEqual([]);
    callbacks.forEach((callback) => {
      callback(1);
    });
    await flushed;

    expect(calls).toEqual(["raf"]);
    requestAnimationFrameSpy.mockRestore();
  });

  it("rejects requestAnimationFrame flushes when RAF is unavailable", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    vi.stubGlobal("requestAnimationFrame", undefined);

    await expect(flushRaf()).rejects.toThrow("requestAnimationFrame is unavailable");

    vi.stubGlobal("requestAnimationFrame", originalRequestAnimationFrame);
  });

  it("keeps the legacy helper as microtask then macrotask", async () => {
    const calls: string[] = [];

    setTimeout(() => calls.push("timer"), 0);
    void Promise.resolve().then(() => calls.push("microtask"));

    await flushMicrotasksAndRealTimer();

    expect(calls).toEqual(["microtask", "timer"]);
  });
});
