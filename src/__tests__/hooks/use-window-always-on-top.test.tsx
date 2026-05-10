import { act, render, waitFor } from "@testing-library/react";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowAlwaysOnTop } from "@/hooks/use-window-always-on-top";
import { RUNTIME_DIAGNOSTIC_POLICIES, resetRuntimeDiagnosticOnceSuppressionForTests } from "@/lib/runtime/diagnostics";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const { isAlwaysOnTopMock, isFullscreenMock, setAlwaysOnTopMock } = vi.hoisted(() => ({
  isAlwaysOnTopMock: vi.fn(),
  isFullscreenMock: vi.fn(),
  setAlwaysOnTopMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isAlwaysOnTop: isAlwaysOnTopMock,
    isFullscreen: isFullscreenMock,
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
    resetRuntimeDiagnosticOnceSuppressionForTests();
    setTauriRuntimePresent();
    isAlwaysOnTopMock.mockReset();
    isAlwaysOnTopMock.mockResolvedValue(false);
    isFullscreenMock.mockReset();
    isFullscreenMock.mockResolvedValue(false);
    setAlwaysOnTopMock.mockReset();
    setAlwaysOnTopMock.mockResolvedValue(undefined);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ toastMessage: null });
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
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to update window always-on-top state",
        new Error("permission denied"),
      );
    });
  });

  it("keeps the optimistic preference and does not toast when the native always-on-top command fails", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    setAlwaysOnTopMock.mockRejectedValue(new Error("permission denied"));

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to update window always-on-top state",
        new Error("permission denied"),
      );
    });
    expect(usePreferencesStore.getState().prefs.window_always_on_top).toBe("true");
    expect(useUiStore.getState().toastMessage).toBeNull();
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

  it("warns when the runtime always-on-top state drifts from the preference after apply", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    isAlwaysOnTopMock.mockResolvedValue(false);

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
      expect(isAlwaysOnTopMock).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Window always-on-top preference drift detected",
        "preferred=true",
        "actual=false",
      );
    });
  });

  it("warns when fullscreen may conflict with an enabled always-on-top preference", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    isAlwaysOnTopMock.mockResolvedValue(true);
    isFullscreenMock.mockResolvedValue(true);

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
      expect(isFullscreenMock).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Window always-on-top preference is enabled while fullscreen is active",
      );
    });
  });

  it("surfaces runtime drift check failures to debug output", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    isAlwaysOnTopMock.mockRejectedValue(new Error("state unavailable"));

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to read window always-on-top state",
        new Error("state unavailable"),
      );
    });
  });

  it("connects always-on-top failures to the runtime diagnostics policy", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    setAlwaysOnTopMock.mockRejectedValue(new Error("TOKEN=secret"));

    render(<HookHarness />);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to update window always-on-top state",
        expect.objectContaining({ message: "TOKEN=<redacted>" }),
      );
    });

    expect(RUNTIME_DIAGNOSTIC_POLICIES["window-always-on-top"]).toMatchObject({
      devOnlyConsole: false,
      productionDiagnostics: true,
      once: false,
      redactSecrets: true,
    });
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
