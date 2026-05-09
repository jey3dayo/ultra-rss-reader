import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useAsyncCommandLifecycle,
  useBrowserUrlEffect,
  useBrowserUrlLayoutEffect,
} from "@/components/reader/hooks/browser/use-browser-url-effect";
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

  it("guards cleanup failures", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cleanupError = new Error("cleanup failed");
    const { unmount } = renderHook(() => {
      useBrowserUrlEffect("https://example.com/article", () => {
        return () => {
          throw cleanupError;
        };
      }, []);
    });

    unmount();

    expect(warnSpy).toHaveBeenCalledWith("Failed to cleanup browser URL effect.", cleanupError);
    warnSpy.mockRestore();
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

describe("useAsyncCommandLifecycle", () => {
  it("tracks latest commands and in-flight state", () => {
    const { result } = renderHook(() => useAsyncCommandLifecycle());

    const firstRun = result.current.start();
    expect(result.current.isInFlight()).toBe(true);
    expect(firstRun.requestId).toBe(1);
    expect(firstRun.isLatest()).toBe(true);

    const secondRun = result.current.start();
    expect(secondRun.requestId).toBe(2);
    expect(firstRun.isLatest()).toBe(false);
    expect(secondRun.isLatest()).toBe(true);

    firstRun.finish();
    expect(result.current.isInFlight()).toBe(true);

    secondRun.finish();
    expect(result.current.isInFlight()).toBe(false);
  });

  it("invalidates active commands when reset", () => {
    const { result } = renderHook(() => useAsyncCommandLifecycle());

    const run = result.current.start();
    result.current.reset();

    expect(run.isLatest()).toBe(false);
    expect(result.current.isInFlight()).toBe(false);
  });
});
