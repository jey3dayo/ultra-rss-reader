import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserOverlayViewportWidth } from "@/components/reader/hooks/browser/use-browser-overlay-viewport-width";

describe("useBrowserOverlayViewportWidth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1400,
    });
  });

  it("tracks window width changes", () => {
    const { result } = renderHook(() => useBrowserOverlayViewportWidth());

    expect(result.current).toBe(1400);

    act(() => {
      window.innerWidth = 960;
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(960);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    "960",
    null,
  ])("falls back when window.innerWidth is malformed: %s", (innerWidth) => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: innerWidth,
    });

    const { result } = renderHook(() => useBrowserOverlayViewportWidth());

    expect(result.current).toBe(1400);
  });

  it("does not update from resize events after unmount", () => {
    const { result, unmount } = renderHook(() => useBrowserOverlayViewportWidth());

    expect(result.current).toBe(1400);

    unmount();

    act(() => {
      window.innerWidth = 960;
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(1400);
  });

  it("keeps the fallback width when resize listener binding fails", () => {
    const error = new Error("resize unavailable");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
      if (type === "resize") {
        throw error;
      }
      return EventTarget.prototype.addEventListener.call(window, type, listener, options);
    });

    const { result } = renderHook(() => useBrowserOverlayViewportWidth());

    expect(result.current).toBe(1400);
    expect(warn).toHaveBeenCalledWith("Failed to bind browser overlay viewport resize listener.", error);
  });

  it("logs resize listener cleanup failures without throwing on unmount", () => {
    const error = new Error("cleanup failed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(window, "removeEventListener").mockImplementation((type, listener, options) => {
      if (type === "resize") {
        throw error;
      }
      return EventTarget.prototype.removeEventListener.call(window, type, listener, options);
    });

    const { unmount } = renderHook(() => useBrowserOverlayViewportWidth());

    expect(() => unmount()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith("Failed to remove window event listener.", error);
  });
});
