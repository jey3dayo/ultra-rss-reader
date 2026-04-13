import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useBrowserOverlayViewportWidth } from "@/components/reader/use-browser-overlay-viewport-width";

describe("useBrowserOverlayViewportWidth", () => {
  beforeEach(() => {
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
});
