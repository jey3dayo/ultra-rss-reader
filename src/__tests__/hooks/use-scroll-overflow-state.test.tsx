import { act, renderHook } from "@testing-library/react";
import { mockObserverConstructors } from "@tests/helpers/typed-test-factories";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrollOverflowState } from "@/components/settings/hooks/use-scroll-overflow-state";

let cleanupObserverMocks: (() => void) | null = null;

function mockScrollObservers() {
  const mocks = mockObserverConstructors();
  cleanupObserverMocks = mocks.cleanupObservers;
  return mocks;
}

function setScrollMetrics(
  element: HTMLElement,
  clientHeight: number,
  scrollHeight: number,
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
}

function setTrackedScrollMetrics(
  element: HTMLElement,
  clientHeight: number,
  scrollHeight: number,
) {
  const readCounts = {
    clientHeight: 0,
    scrollHeight: 0,
  };

  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => {
      readCounts.clientHeight += 1;
      return clientHeight;
    },
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => {
      readCounts.scrollHeight += 1;
      return scrollHeight;
    },
  });

  return readCounts;
}

describe("useScrollOverflowState", () => {
  afterEach(() => {
    cleanupObserverMocks?.();
    cleanupObserverMocks = null;
    vi.useRealTimers();
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
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    const viewport = document.createElement("div");
    setScrollMetrics(viewport, 100, 100);

    const { result, unmount } = renderHook(() =>
      useScrollOverflowState("settings"),
    );

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

  it("falls back to timeout measurement when requestAnimationFrame is unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("MutationObserver", undefined);
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const viewport = document.createElement("div");
    setScrollMetrics(viewport, 100, 100);

    const { result, unmount } = renderHook(() =>
      useScrollOverflowState("settings"),
    );

    act(() => {
      result.current.viewportRef(viewport);
    });

    expect(result.current.hasOverflow).toBe(false);

    setScrollMetrics(viewport, 100, 140);

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current.hasOverflow).toBe(true);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("cancels pending animation frame and ignores late callbacks after unmount", () => {
    let animationFrameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("MutationObserver", undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 7;
    });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    const viewport = document.createElement("div");
    setScrollMetrics(viewport, 100, 100);

    const { result, unmount } = renderHook(() =>
      useScrollOverflowState("settings"),
    );

    act(() => {
      result.current.viewportRef(viewport);
    });

    setScrollMetrics(viewport, 100, 140);
    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(7);

    expect(() => {
      act(() => {
        animationFrameCallback?.(0);
      });
    }).not.toThrow();
  });

  it("disconnects observers when the dependency changes", () => {
    const { resizeObservers, mutationObservers } = mockScrollObservers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const viewport = document.createElement("div");
    viewport.appendChild(document.createElement("div"));
    setScrollMetrics(viewport, 100, 140);

    const { result, rerender } = renderHook(
      ({ dependency }: { dependency: string }) =>
        useScrollOverflowState(dependency),
      {
        initialProps: { dependency: "settings" },
      },
    );

    act(() => {
      result.current.viewportRef(viewport);
    });

    expect(resizeObservers).toHaveLength(1);
    expect(mutationObservers).toHaveLength(1);
    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(viewport);

    rerender({ dependency: "accounts" });

    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(mutationObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(resizeObservers).toHaveLength(2);
    expect(mutationObservers).toHaveLength(2);
  });

  it("disconnects observers when the viewport node changes and on unmount", () => {
    const { resizeObservers, mutationObservers } = mockScrollObservers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const firstViewport = document.createElement("div");
    const secondViewport = document.createElement("div");
    setScrollMetrics(firstViewport, 100, 140);
    setScrollMetrics(secondViewport, 100, 100);

    const { result, unmount } = renderHook(() =>
      useScrollOverflowState("settings"),
    );

    act(() => {
      result.current.viewportRef(firstViewport);
    });

    expect(resizeObservers).toHaveLength(1);
    expect(mutationObservers).toHaveLength(1);

    act(() => {
      result.current.viewportRef(secondViewport);
    });

    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(mutationObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(resizeObservers).toHaveLength(2);
    expect(mutationObservers).toHaveLength(2);
    expect(resizeObservers[1]?.observe).toHaveBeenCalledWith(secondViewport);

    unmount();

    expect(resizeObservers[1]?.disconnect).toHaveBeenCalledTimes(1);
    expect(mutationObservers[1]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("observes content children added after observer setup", () => {
    const { resizeObservers, mutationObservers } = mockScrollObservers();
    let animationFrameCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const viewport = document.createElement("div");
    setScrollMetrics(viewport, 100, 100);

    const { result, unmount } = renderHook(() =>
      useScrollOverflowState("settings"),
    );

    act(() => {
      result.current.viewportRef(viewport);
    });

    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(viewport);

    const content = document.createElement("div");
    viewport.replaceChildren(content);
    setScrollMetrics(viewport, 100, 140);

    act(() => {
      mutationObservers[0]?.flush();
    });
    act(() => {
      animationFrameCallback?.(0);
    });

    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(content);
    expect(result.current.hasOverflow).toBe(true);

    unmount();

    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(mutationObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("updates overflow when content child is added and then resized", () => {
    const { resizeObservers } = mockScrollObservers();
    let animationFrameCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const viewport = document.createElement("div");
    setScrollMetrics(viewport, 100, 100);

    const { result } = renderHook(() => useScrollOverflowState("settings"));

    act(() => {
      result.current.viewportRef(viewport);
    });

    const content = document.createElement("div");
    viewport.appendChild(content);
    setScrollMetrics(viewport, 100, 140);

    act(() => {
      resizeObservers[0]?.flush();
    });
    act(() => {
      animationFrameCallback?.(0);
    });

    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(content);
    expect(result.current.hasOverflow).toBe(true);
  });

  it("updates overflow when content child is replaced and then resized", () => {
    const { resizeObservers, mutationObservers } = mockScrollObservers();
    let animationFrameCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const viewport = document.createElement("div");
    const initialContent = document.createElement("div");
    viewport.appendChild(initialContent);
    setScrollMetrics(viewport, 100, 140);

    const { result } = renderHook(() => useScrollOverflowState("settings"));

    act(() => {
      result.current.viewportRef(viewport);
    });

    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(initialContent);
    expect(result.current.hasOverflow).toBe(true);

    const replacementContent = document.createElement("div");
    viewport.replaceChildren(replacementContent);
    setScrollMetrics(viewport, 100, 100);

    act(() => {
      mutationObservers[0]?.flush();
    });
    act(() => {
      animationFrameCallback?.(0);
    });

    expect(resizeObservers[0]?.unobserve).toHaveBeenCalledWith(initialContent);
    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(
      replacementContent,
    );
    expect(result.current.hasOverflow).toBe(false);

    setScrollMetrics(viewport, 100, 150);

    act(() => {
      resizeObservers[0]?.flush();
    });
    act(() => {
      animationFrameCallback?.(0);
    });

    expect(result.current.hasOverflow).toBe(true);
  });

  it("coalesces high-frequency mutation overflow reads into one scheduled measurement", () => {
    const { mutationObservers } = mockScrollObservers();
    let animationFrameCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const viewport = document.createElement("div");
    viewport.appendChild(document.createElement("div"));
    const readCounts = setTrackedScrollMetrics(viewport, 100, 140);

    const { result } = renderHook(() => useScrollOverflowState("settings"));

    act(() => {
      result.current.viewportRef(viewport);
    });

    expect(result.current.hasOverflow).toBe(true);
    expect(readCounts.scrollHeight).toBe(1);
    expect(readCounts.clientHeight).toBe(1);

    act(() => {
      mutationObservers[0]?.flush();
      mutationObservers[0]?.flush();
      mutationObservers[0]?.flush();
    });

    expect(readCounts.scrollHeight).toBe(1);
    expect(readCounts.clientHeight).toBe(1);

    act(() => {
      animationFrameCallback?.(0);
    });

    expect(readCounts.scrollHeight).toBe(2);
    expect(readCounts.clientHeight).toBe(2);
  });
});
