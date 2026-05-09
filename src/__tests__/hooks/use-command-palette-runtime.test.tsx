import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteRuntime } from "@/components/reader/hooks/command-palette/use-command-palette-runtime";
import { loadRuntimeDevScenarios } from "@/dev/scenario-runtime";

vi.mock("@/dev/scenario-runtime", () => ({
  loadRuntimeDevScenarios: vi.fn(),
}));

const loadRuntimeDevScenariosMock = vi.mocked(loadRuntimeDevScenarios);

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
    loadRuntimeDevScenariosMock.mockResolvedValue([
      {
        id: "open-add-feed-dialog",
        title: "Open add feed dialog",
        keywords: ["add", "feed"],
      },
    ]);
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

    expect(loadRuntimeDevScenariosMock).not.toHaveBeenCalled();
    expect(result.current.devScenarios).toEqual([]);
  });

  it("ignores a successful dev scenario load after unmount", async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof loadRuntimeDevScenarios>>>();
    loadRuntimeDevScenariosMock.mockReturnValueOnce(deferred.promise);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useCommandPaletteRuntime({ open: true }));

    expect(result.current.devScenarios).toEqual([]);
    unmount();

    await act(async () => {
      deferred.resolve([
        {
          id: "open-add-feed-dialog",
          title: "Open add feed dialog",
          keywords: ["add", "feed"],
        },
      ]);
      await deferred.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("ignores a failed dev scenario load after unmount", async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof loadRuntimeDevScenarios>>>();
    loadRuntimeDevScenariosMock.mockReturnValueOnce(deferred.promise);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useCommandPaletteRuntime({ open: true }));

    expect(result.current.devScenarios).toEqual([]);
    unmount();

    await act(async () => {
      deferred.reject(new Error("load failed"));
      await expect(deferred.promise).rejects.toThrow("load failed");
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
