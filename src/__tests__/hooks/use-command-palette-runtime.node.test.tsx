import { Result } from "@praha/byethrow";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteRuntime } from "@/components/reader/hooks/command-palette/use-command-palette-runtime";
import type { loadRuntimeDevScenariosResult } from "@/dev/scenario-runtime";

const { loadRuntimeDevScenariosResultMock } = vi.hoisted(() => ({
  loadRuntimeDevScenariosResultMock: vi.fn<() => ReturnType<typeof loadRuntimeDevScenariosResult>>(),
}));

vi.mock("@/dev/scenario-runtime", () => ({
  loadRuntimeDevScenariosResult: loadRuntimeDevScenariosResultMock,
}));

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("useCommandPaletteRuntime", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    loadRuntimeDevScenariosResultMock.mockResolvedValue(
      Result.succeed([
        {
          id: "open-add-feed-dialog",
          title: "Open add feed dialog",
          keywords: ["add", "feed"],
        },
      ]),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("resets input and deferred query on close while retaining loaded dev scenarios", async () => {
    const { result, rerender } = renderHook(({ open }: { open: boolean }) => useCommandPaletteRuntime({ open }), {
      initialProps: { open: true },
    });

    await waitFor(() => {
      expect(result.current.devScenarios).toHaveLength(1);
    });

    act(() => {
      result.current.setInput("   >   settings");
    });

    await waitFor(() => {
      expect(result.current.query).toBe("settings");
      expect(result.current.deferredQuery).toBe("settings");
    });

    rerender({ open: false });

    await waitFor(() => {
      expect(result.current.input).toBe("");
      expect(result.current.query).toBe("");
      expect(result.current.deferredQuery).toBe("");
    });
    expect(result.current.devScenarios).toEqual([
      {
        id: "open-add-feed-dialog",
        title: "Open add feed dialog",
        keywords: ["add", "feed"],
      },
    ]);

    rerender({ open: true });

    expect(result.current.input).toBe("");
    expect(result.current.query).toBe("");
    expect(result.current.deferredQuery).toBe("");
    expect(result.current.devScenarios).toEqual([
      {
        id: "open-add-feed-dialog",
        title: "Open add feed dialog",
        keywords: ["add", "feed"],
      },
    ]);
  });

  it("does not load runtime dev scenarios outside development builds", () => {
    vi.stubEnv("DEV", false);

    const { result } = renderHook(() => useCommandPaletteRuntime({ open: true }));

    expect(loadRuntimeDevScenariosResultMock).not.toHaveBeenCalled();
    expect(result.current.devScenarios).toEqual([]);
    expect(result.current.devScenarioLoadError).toBeNull();
  });

  it("ignores a successful dev scenario load after unmount", async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof loadRuntimeDevScenariosResult>>>();
    loadRuntimeDevScenariosResultMock.mockReturnValueOnce(deferred.promise);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useCommandPaletteRuntime({ open: true }));

    expect(result.current.devScenarios).toEqual([]);
    unmount();

    await act(async () => {
      deferred.resolve(
        Result.succeed([
          {
            id: "open-add-feed-dialog",
            title: "Open add feed dialog",
            keywords: ["add", "feed"],
          },
        ]),
      );
      await deferred.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("ignores a failed dev scenario load after unmount", async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof loadRuntimeDevScenariosResult>>>();
    loadRuntimeDevScenariosResultMock.mockReturnValueOnce(deferred.promise);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useCommandPaletteRuntime({ open: true }));

    expect(result.current.devScenarios).toEqual([]);
    unmount();

    await act(async () => {
      deferred.reject(new Error("load failed"));
      await expect(deferred.promise).rejects.toThrow("load failed");
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("ignores stale dev scenario loads after close and reopen", async () => {
    const staleLoad = createDeferred<Awaited<ReturnType<typeof loadRuntimeDevScenariosResult>>>();
    const currentLoad = createDeferred<Awaited<ReturnType<typeof loadRuntimeDevScenariosResult>>>();
    loadRuntimeDevScenariosResultMock.mockReturnValueOnce(staleLoad.promise).mockReturnValueOnce(currentLoad.promise);

    const { result, rerender } = renderHook(({ open }: { open: boolean }) => useCommandPaletteRuntime({ open }), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    rerender({ open: true });

    await act(async () => {
      currentLoad.resolve(
        Result.succeed([
          {
            id: "open-add-feed-dialog",
            title: "Current scenario",
            keywords: ["current"],
          },
        ]),
      );
      await currentLoad.promise;
    });

    await waitFor(() => {
      expect(result.current.devScenarios).toEqual([
        {
          id: "open-add-feed-dialog",
          title: "Current scenario",
          keywords: ["current"],
        },
      ]);
    });

    await act(async () => {
      staleLoad.resolve(
        Result.succeed([
          {
            id: "open-add-feed-dialog",
            title: "Stale scenario",
            keywords: ["stale"],
          },
        ]),
      );
      await staleLoad.promise;
    });

    expect(result.current.devScenarios).toEqual([
      {
        id: "open-add-feed-dialog",
        title: "Current scenario",
        keywords: ["current"],
      },
    ]);
  });

  it("exposes and warns about dev scenario load failures without treating them as empty results", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    loadRuntimeDevScenariosResultMock.mockResolvedValueOnce(
      Result.fail({
        type: "module_load_failed",
        message: "Temporary import failure",
      }),
    );

    const { result } = renderHook(() => useCommandPaletteRuntime({ open: true }));

    await waitFor(() => {
      expect(result.current.devScenarioLoadError).toEqual({
        type: "module_load_failed",
        message: "Temporary import failure",
      });
    });
    expect(result.current.devScenarios).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith("Command palette dev scenario loader failed.", {
      type: "module_load_failed",
      message: "Temporary import failure",
    });

    consoleWarnSpy.mockRestore();
  });
});
