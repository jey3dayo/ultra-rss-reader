import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelAnimationFrameHandle,
  scheduleAnimationFrame,
  scheduleAnimationFrameWithTimeoutFallback,
} from "@/lib/dom/animation-frame";

setupBrowserTestDom();

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
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: undefined,
    });

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
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: undefined,
    });

    expect(() => cancelAnimationFrameHandle(42)).not.toThrow();
  });

  it("schedules a cancellable callback with timeout fallback", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: undefined,
    });
    const callback = vi.fn();

    const cancel = scheduleAnimationFrameWithTimeoutFallback(callback);
    cancel();
    vi.runOnlyPendingTimers();

    expect(callback).not.toHaveBeenCalled();
  });
});
