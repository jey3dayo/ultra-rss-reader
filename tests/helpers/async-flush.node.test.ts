import { describe, expect, it, vi } from "vitest";
import { flushMacrotask, flushMicrotasks, flushMicrotasksAndRealTimer } from "./async-flush";

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

  it("keeps the legacy helper as microtask then macrotask", async () => {
    const calls: string[] = [];

    setTimeout(() => calls.push("timer"), 0);
    void Promise.resolve().then(() => calls.push("microtask"));

    await flushMicrotasksAndRealTimer();

    expect(calls).toEqual(["microtask", "timer"]);
  });
});
