import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelAnimationFrameHandle,
  scheduleAnimationFrame,
  scheduleAnimationFrameWithTimeoutFallback,
} from "@/lib/dom/animation-frame";

describe("animation frame DOM helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("schedules an animation frame callback", () => {
    const callback = vi.fn();
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);

    expect(scheduleAnimationFrame(callback)).toBe(42);
    expect(requestAnimationFrameSpy).toHaveBeenCalledWith(callback);
  });

  it("returns null when animation frames are unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);

    expect(scheduleAnimationFrame(vi.fn())).toBeNull();
  });

  it("warns and returns null when scheduling throws", () => {
    const requestError = new Error("requestAnimationFrame unavailable");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
      throw requestError;
    });

    expect(scheduleAnimationFrame(vi.fn(), { warningMessage: "Failed to schedule focus." })).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith("Failed to schedule focus.", requestError);
  });

  it("cancels an animation frame handle", () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    cancelAnimationFrameHandle(42);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
  });

  it("skips cancellation when animation frame cancellation is unavailable", () => {
    vi.stubGlobal("cancelAnimationFrame", undefined);

    expect(() => cancelAnimationFrameHandle(42)).not.toThrow();
  });

  it("schedules a cancellable callback with timeout fallback", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);
    const callback = vi.fn();

    const cancel = scheduleAnimationFrameWithTimeoutFallback(callback);
    cancel();
    vi.runOnlyPendingTimers();

    expect(callback).not.toHaveBeenCalled();
  });
});
