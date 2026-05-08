import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrollOverflowState } from "@/components/settings/hooks/use-scroll-overflow-state";

function setScrollMetrics(element: HTMLElement, clientHeight: number, scrollHeight: number) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
}

describe("useScrollOverflowState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses animation frame and resize fallback when observers are unavailable", () => {
    let animationFrameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("MutationObserver", undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 1;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const viewport = document.createElement("div");
    setScrollMetrics(viewport, 100, 100);

    const { result, unmount } = renderHook(() => useScrollOverflowState("settings"));

    act(() => {
      result.current.viewportRef(viewport);
    });

    expect(result.current.hasOverflow).toBe(false);

    setScrollMetrics(viewport, 100, 140);
    act(() => {
      animationFrameCallback?.(0);
    });
    expect(result.current.hasOverflow).toBe(true);

    setScrollMetrics(viewport, 100, 100);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.hasOverflow).toBe(false);

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1);
  });
});
