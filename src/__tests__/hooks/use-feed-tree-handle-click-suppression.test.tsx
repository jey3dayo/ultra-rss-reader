import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFeedTreeHandleClickSuppression } from "@/components/reader/hooks/feed-tree/use-feed-tree-handle-click-suppression";

describe("useFeedTreeHandleClickSuppression", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("suppresses handle clicks until the next macrotask after queueing a reset", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useFeedTreeHandleClickSuppression());

    expect(result.current.consumeSuppressedHandleClick()).toBe(false);

    act(() => {
      result.current.queueSuppressHandleClickReset();
    });

    expect(result.current.consumeSuppressedHandleClick()).toBe(true);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.consumeSuppressedHandleClick()).toBe(false);
  });

  it("restarts the reset timer when queueing suppression again", () => {
    vi.useFakeTimers();

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { result } = renderHook(() => useFeedTreeHandleClickSuppression());

    act(() => {
      result.current.queueSuppressHandleClickReset();
      result.current.queueSuppressHandleClickReset();
    });

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.consumeSuppressedHandleClick()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("consumes a queued cancel suppression on the next handle click", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useFeedTreeHandleClickSuppression());

    act(() => {
      result.current.queueSuppressHandleClickReset();
    });

    expect(result.current.consumeSuppressedHandleClick()).toBe(true);
    expect(result.current.consumeSuppressedHandleClick()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up pending timers on unmount", () => {
    vi.useFakeTimers();

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { result, unmount } = renderHook(() => useFeedTreeHandleClickSuppression());

    act(() => {
      result.current.queueSuppressHandleClickReset();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
