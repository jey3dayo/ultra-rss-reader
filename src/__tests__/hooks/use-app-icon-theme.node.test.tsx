import { existsSync } from "node:fs";
import { Result } from "@praha/byethrow";
import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { flushMicrotasksAndRealTimer } from "@tests/helpers/async-flush";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createLegacyMatchMedia, createModernMatchMedia } from "@tests/helpers/match-media";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_ICON_THEME_PATHS, useAppIconTheme } from "@/hooks/use-app-icon-theme";
import { RUNTIME_DIAGNOSTIC_POLICIES, resetRuntimeDiagnosticOnceSuppressionForTests } from "@/lib/runtime/diagnostics";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";

const { setIconMock } = vi.hoisted(() => ({
  setIconMock: vi.fn(),
}));

vi.mock("@/lib/window/tauri-window", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/window/tauri-window")>();

  return {
    ...original,
    setWindowIcon: setIconMock,
  };
});

setupBrowserTestDom();

const defaultCapabilities = {
  supports_reading_list: false,
  supports_background_browser_open: false,
  supports_runtime_window_icon_replacement: false,
  supports_native_browser_navigation: false,
  uses_dev_file_credentials: false,
};

function HookHarness() {
  useAppIconTheme();
  return null;
}

function stubMatchMedia(matchMedia: ((query: string) => unknown) | undefined) {
  vi.stubGlobal("matchMedia", matchMedia);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function setPlatformState({
  loaded,
  supportsRuntimeWindowIconReplacement,
  kind = "windows",
}: {
  loaded: boolean;
  supportsRuntimeWindowIconReplacement: boolean;
  kind?: "windows" | "macos" | "linux" | "unknown";
}) {
  usePlatformStore.setState({
    loaded,
    platform: {
      kind,
      capabilities: {
        ...defaultCapabilities,
        supports_runtime_window_icon_replacement: supportsRuntimeWindowIconReplacement,
      },
    },
  });
}

describe("useAppIconTheme", () => {
  beforeEach(() => {
    setIconMock.mockReset();
    setIconMock.mockResolvedValue(Result.succeed(undefined));
    resetRuntimeDiagnosticOnceSuppressionForTests();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    usePlatformStore.setState(usePlatformStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the light icon when the theme is light", async () => {
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });
  });

  it("keeps runtime app icon paths backed by public assets", () => {
    for (const iconPath of Object.values(APP_ICON_THEME_PATHS)) {
      expect(existsSync(`${process.cwd()}/public${iconPath}`), iconPath).toBe(true);
    }
  });

  it("classifies runtime diagnostics without toast and with secret redaction", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    setIconMock.mockResolvedValue(
      Result.fail(new Error("TOKEN=secret https://alice:password@example.com/icon.png?token=secret#secret")),
    );
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    const first = render(<HookHarness />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledTimes(1);
    });
    first.unmount();

    render(<HookHarness />);

    await flushMicrotasksAndRealTimer();

    const appIconPolicy = RUNTIME_DIAGNOSTIC_POLICIES["app-icon-theme"];
    expect(appIconPolicy).toMatchObject({
      devOnlyConsole: false,
      productionDiagnostics: true,
      once: true,
      redactSecrets: true,
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to apply light app icon theme",
      expect.objectContaining({
        message: "TOKEN=<redacted> https://example.com/icon.png?redacted#redacted",
      }),
    );
    expect(String(consoleError.mock.calls[0]?.[1])).not.toContain("secret");
    expect(String(consoleError.mock.calls[0]?.[1])).not.toContain("password");

    consoleError.mockRestore();
  });

  it("treats missing dev icon files as a no-op runtime icon replacement", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    setIconMock.mockResolvedValue(Result.fail(new Error("指定されたパスが見つかりません。 (os error 3)")));
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });
    await flushMicrotasksAndRealTimer();

    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("tracks system theme changes", async () => {
    const mql = createModernMatchMedia(true);
    stubMatchMedia(vi.fn(() => mql));
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });

    mql.dispatch(false);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });
  });

  it("coalesces rapid system theme changes before starting the icon side effect", async () => {
    const mql = createModernMatchMedia(true);
    stubMatchMedia(vi.fn(() => mql));
    setIconMock.mockResolvedValue(undefined);
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);
    mql.dispatch(false);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledTimes(1);
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).toHaveBeenCalledTimes(1);
  });

  it("removes the system theme listener when switching to an explicit theme", async () => {
    const mql = createModernMatchMedia(true);
    stubMatchMedia(vi.fn(() => mql));
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });
    expect(mql.listenerCount()).toBe(1);

    act(() => {
      usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    });

    await waitFor(() => {
      expect(mql.listenerCount()).toBe(0);
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });

    const callsAfterExplicitTheme = setIconMock.mock.calls.length;

    mql.dispatch(false);

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).toHaveBeenCalledTimes(callsAfterExplicitTheme);
  });

  it("skips runtime icon replacement when capability is disabled", async () => {
    const mql = createModernMatchMedia(true);
    stubMatchMedia(vi.fn(() => mql));
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      kind: "macos",
      supportsRuntimeWindowIconReplacement: false,
    });

    render(<HookHarness />);

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("skips runtime icon replacement when platform info is not loaded", async () => {
    const mql = createModernMatchMedia(true);
    stubMatchMedia(vi.fn(() => mql));
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: false,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("falls back without throwing when system theme cannot read matchMedia", async () => {
    stubMatchMedia(undefined);
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    expect(() => render(<HookHarness />)).not.toThrow();

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("falls back without throwing when matchMedia itself throws", async () => {
    stubMatchMedia(
      vi.fn(() => {
        throw new Error("matchMedia unavailable");
      }),
    );
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    expect(() => render(<HookHarness />)).not.toThrow();

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("uses legacy system theme listeners and ignores cleanup failures", async () => {
    const mql = createLegacyMatchMedia(true, { throwOnRemove: true });
    stubMatchMedia(vi.fn(() => mql));
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    const { unmount } = render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });
    expect(mql.listenerCount()).toBe(1);

    act(() => {
      mql.dispatch(false);
    });

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });

    expect(() => unmount()).not.toThrow();
  });

  it("applies icon after platform info loads and runtime replacement becomes available", async () => {
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    setPlatformState({
      loaded: false,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await flushMicrotasksAndRealTimer();
    expect(setIconMock).not.toHaveBeenCalled();

    act(() => {
      setPlatformState({
        loaded: true,
        supportsRuntimeWindowIconReplacement: true,
      });
    });

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });
  });

  it("treats runtime icon replacement failures as no-op and reflects the next theme state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    setIconMock
      .mockResolvedValueOnce(Result.fail(new Error("runtime icon unavailable")))
      .mockResolvedValue(Result.succeed(undefined));
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });

    act(() => {
      usePreferencesStore.setState({ prefs: { theme: "dark" }, loaded: true });
    });

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to apply light app icon theme",
      new Error("runtime icon unavailable"),
    );
  });

  it("applies only the latest queued icon request after rapid theme changes", async () => {
    const firstIconRequest = createDeferred<
      ReturnType<typeof Result.succeed<undefined>> | ReturnType<typeof Result.fail<Error>>
    >();
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    setIconMock.mockImplementationOnce(() => firstIconRequest.promise).mockResolvedValue(Result.succeed(undefined));
    usePreferencesStore.setState({ prefs: { theme: "dark" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });

    act(() => {
      usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    });

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).toHaveBeenCalledTimes(1);

    act(() => {
      firstIconRequest.resolve(Result.succeed(undefined));
    });

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledTimes(2);
      expect(setIconMock).toHaveBeenLastCalledWith("/icons/app-icon-light.png");
    });
  });

  it("continues with the latest queued icon request after an OS command failure", async () => {
    const firstIconRequest = createDeferred<
      ReturnType<typeof Result.succeed<undefined>> | ReturnType<typeof Result.fail<Error>>
    >();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    setIconMock.mockImplementationOnce(() => firstIconRequest.promise).mockResolvedValue(Result.succeed(undefined));
    usePreferencesStore.setState({ prefs: { theme: "dark" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });

    act(() => {
      usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    });

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).toHaveBeenCalledTimes(1);

    act(() => {
      firstIconRequest.resolve(Result.fail(new Error("OS icon update failed")));
    });
    await Promise.allSettled([firstIconRequest.promise]);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledTimes(2);
      expect(setIconMock).toHaveBeenLastCalledWith("/icons/app-icon-light.png");
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to apply dark app icon theme",
      new Error("OS icon update failed"),
    );

    consoleError.mockRestore();
  });

  it("does not replay a stale intermediate system theme request when the latest request matches the in-flight icon", async () => {
    const firstIconRequest = createDeferred<ReturnType<typeof Result.succeed<undefined>>>();
    const mql = createModernMatchMedia(true);
    stubMatchMedia(vi.fn(() => mql));
    setIconMock.mockImplementationOnce(() => firstIconRequest.promise).mockResolvedValue(Result.succeed(undefined));
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });

    act(() => {
      mql.dispatch(false);
      mql.dispatch(true);
    });

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).toHaveBeenCalledTimes(1);

    act(() => {
      firstIconRequest.resolve(Result.succeed(undefined));
    });

    await flushMicrotasksAndRealTimer();

    expect(setIconMock).toHaveBeenCalledTimes(1);
  });

  it("does not apply queued icon requests after unmount", async () => {
    const firstIconRequest = createDeferred<ReturnType<typeof Result.succeed<undefined>>>();
    stubMatchMedia(vi.fn(() => createModernMatchMedia(false)));
    setIconMock.mockImplementationOnce(() => firstIconRequest.promise).mockResolvedValue(Result.succeed(undefined));
    usePreferencesStore.setState({ prefs: { theme: "dark" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    const { unmount } = render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });

    act(() => {
      usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    });

    await flushMicrotasksAndRealTimer();
    unmount();

    act(() => {
      firstIconRequest.resolve(Result.succeed(undefined));
    });
    await flushMicrotasksAndRealTimer();

    expect(setIconMock).toHaveBeenCalledTimes(1);
  });
});
