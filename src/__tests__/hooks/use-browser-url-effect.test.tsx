import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBrowserUrlEffect, useBrowserUrlLayoutEffect } from "@/components/reader/use-browser-url-effect";
import { useUiStore } from "@/stores/ui-store";

describe("useBrowserUrlEffect", () => {
  afterEach(() => {
    useUiStore.setState({ browserUrl: null });
  });

  it("skips the effect when browserUrl is missing", () => {
    const effect = vi.fn();

    renderHook(() => {
      useBrowserUrlEffect(null, effect, []);
    });

    expect(effect).not.toHaveBeenCalled();
  });

  it("runs the effect with the active browserUrl", () => {
    const effect = vi.fn();

    renderHook(() => {
      useBrowserUrlEffect("https://example.com/article", effect, []);
    });

    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenCalledWith(
      expect.objectContaining({
        browserUrl: "https://example.com/article",
        isCurrent: expect.any(Function),
      }),
    );
  });

  it("reports whether the captured browserUrl is still current", () => {
    useUiStore.setState({ browserUrl: "https://example.com/article" });
    const effect = vi.fn();

    renderHook(() => {
      useBrowserUrlEffect("https://example.com/article", effect, []);
    });

    const scope = effect.mock.calls[0]?.[0];
    expect(scope?.isCurrent()).toBe(true);

    useUiStore.setState({ browserUrl: "https://example.com/next" });

    expect(scope?.isCurrent()).toBe(false);
  });
});

describe("useBrowserUrlLayoutEffect", () => {
  it("runs the layout effect with the active browserUrl", () => {
    const effect = vi.fn();

    renderHook(() => {
      useBrowserUrlLayoutEffect("https://example.com/article", effect, []);
    });

    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenCalledWith(
      expect.objectContaining({
        browserUrl: "https://example.com/article",
        isCurrent: expect.any(Function),
      }),
    );
  });
});
