import "@testing-library/react/dont-cleanup-after-each";
import { Result } from "@praha/byethrow";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
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

vi.mock("@/lib/window/windows", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/window/windows")>();

  return {
    ...original,
    isWindowAlwaysOnTop: isAlwaysOnTopMock,
    isWindowFullscreen: isFullscreenMock,
    setWindowAlwaysOnTop: setAlwaysOnTopMock,
  };
});

setupBrowserTestDom();

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
    isAlwaysOnTopMock.mockResolvedValue(Result.succeed(false));
    isFullscreenMock.mockReset();
    isFullscreenMock.mockResolvedValue(Result.succeed(false));
    setAlwaysOnTopMock.mockReset();
    setAlwaysOnTopMock.mockResolvedValue(Result.succeed(undefined));
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ toastMessage: null });
  });

  afterEach(() => {
    cleanup();
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
    setAlwaysOnTopMock.mockResolvedValue(Result.fail(new Error("permission denied")));

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
    setAlwaysOnTopMock.mockResolvedValue(Result.fail(new Error("permission denied")));

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
    setAlwaysOnTopMock.mockResolvedValue(Result.fail(new Error("always-on-top is unsupported on this platform")));

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
    isAlwaysOnTopMock.mockResolvedValueOnce(Result.succeed(false)).mockResolvedValueOnce(Result.succeed(true));

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledTimes(2);
      expect(setAlwaysOnTopMock).toHaveBeenNthCalledWith(1, true);
      expect(setAlwaysOnTopMock).toHaveBeenNthCalledWith(2, true);
      expect(isAlwaysOnTopMock).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Window always-on-top preference drift detected",
        "preferred=true",
        "actual=false",
      );
    });
  });

  it("warns when runtime drift persists after reapplying the latest preference intent", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    isAlwaysOnTopMock.mockResolvedValue(Result.succeed(false));

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Window always-on-top preference drift persisted",
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
    isAlwaysOnTopMock.mockResolvedValue(Result.succeed(true));
    isFullscreenMock.mockResolvedValue(Result.succeed(true));

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
    isAlwaysOnTopMock.mockResolvedValue(Result.fail(new Error("state unavailable")));

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to read window always-on-top state",
        new Error("state unavailable"),
      );
    });
  });

  it("surfaces fullscreen state read failures after applying an enabled preference", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    isAlwaysOnTopMock.mockResolvedValue(Result.succeed(true));
    isFullscreenMock.mockResolvedValue(Result.fail(new Error("fullscreen unavailable")));

    render(<HookHarness />);

    await waitFor(() => {
      expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
      expect(isFullscreenMock).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to read window fullscreen state",
        new Error("fullscreen unavailable"),
      );
    });
  });

  it("connects always-on-top failures to the runtime diagnostics policy", async () => {
    usePreferencesStore.setState({
      prefs: { window_always_on_top: "true" },
      loaded: true,
    });
    setAlwaysOnTopMock.mockResolvedValue(Result.fail(new Error("TOKEN=secret")));

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
    const firstRequest = createDeferred<ReturnType<typeof Result.succeed<undefined>>>();
    const secondRequest = createDeferred<ReturnType<typeof Result.succeed<undefined>>>();
    setAlwaysOnTopMock.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise);
    isAlwaysOnTopMock.mockResolvedValue(Result.succeed(true));

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
    secondRequest.resolve(Result.succeed(undefined));
    await Promise.allSettled([firstRequest.promise, secondRequest.promise]);

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("ignores failures after unmount", async () => {
    const request = createDeferred<ReturnType<typeof Result.succeed<undefined>>>();
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
