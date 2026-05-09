import { act, render, waitFor } from "@testing-library/react";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowAlwaysOnTop } from "@/hooks/use-window-always-on-top";
import { usePreferencesStore } from "@/stores/preferences-store";

const { setAlwaysOnTopMock } = vi.hoisted(() => ({
  setAlwaysOnTopMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setAlwaysOnTop: setAlwaysOnTopMock,
  }),
}));

function HookHarness() {
  useWindowAlwaysOnTop();
  return null;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe("useWindowAlwaysOnTop", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetTauriRuntimeFlags();
    setTauriRuntimePresent();
    setAlwaysOnTopMock.mockReset();
    setAlwaysOnTopMock.mockResolvedValue(undefined);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("keeps the window normal by default", async () => {
    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(false);
    });
  });

  it("keeps the window above other windows when the preference is enabled", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
    });
  });

  it("does not call the native window command when the Tauri runtime is unavailable", async () => {
    resetTauriRuntimeFlags();
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).not.toHaveBeenCalled();
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("surfaces native always-on-top failures to debug output", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    setAlwaysOnTopMock.mockRejectedValue(new Error("permission denied"));

    expect(() => render(<HookHarness />)).not.toThrow();

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith("Failed to update window always-on-top state:", "permission denied");
    });
  });

  it("treats unsupported platform failures as a no-op", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    setAlwaysOnTopMock.mockRejectedValue(new Error("always-on-top is unsupported on this platform"));

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("ignores stale failures from an earlier toggle request", async () => {
    const firstRequest = createDeferred<void>();
    const secondRequest = createDeferred<void>();
    setAlwaysOnTopMock.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise);

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(false);
    });

    act(() => {
      usePreferencesStore.setState({
        prefs: { window_always_on_top: "true" },
        loaded: true,
      });
    });

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
    });

    firstRequest.reject(new Error("stale failure"));
    secondRequest.resolve();
    await Promise.allSettled([firstRequest.promise, secondRequest.promise]);

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("ignores failures after unmount", async () => {
    const request = createDeferred<void>();
    setAlwaysOnTopMock.mockReturnValueOnce(request.promise);

    const { unmount } = render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(false);
    });

    unmount();
    request.reject(new Error("late failure"));
    await Promise.allSettled([request.promise]);

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
