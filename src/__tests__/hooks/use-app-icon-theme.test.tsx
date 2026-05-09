import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppIconTheme } from "@/hooks/use-app-icon-theme";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";

const { setIconMock } = vi.hoisted(() => ({
  setIconMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setIcon: setIconMock,
  }),
}));

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

type MatchMediaChangeEvent = Pick<MediaQueryListEvent, "matches">;

function createMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MatchMediaChangeEvent) => void>();

  return {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_: string, listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.delete(listener);
    },
    listenerCount() {
      return listeners.size;
    },
    dispatch(nextMatches: boolean) {
      matches = nextMatches;
      const event: MatchMediaChangeEvent = { matches: nextMatches };
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

function createLegacyMatchMedia(matches: boolean, options: { throwOnRemove?: boolean } = {}) {
  const listeners = new Set<(event: MatchMediaChangeEvent) => void>();

  return {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      if (options.throwOnRemove) {
        throw new Error("legacy cleanup unavailable");
      }
      listeners.delete(listener);
    },
    listenerCount() {
      return listeners.size;
    },
    dispatch(nextMatches: boolean) {
      matches = nextMatches;
      const event: MatchMediaChangeEvent = { matches: nextMatches };
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
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
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    usePlatformStore.setState(usePlatformStore.getInitialState());
  });

  it("uses the light icon when the theme is light", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => createMatchMedia(false)),
    );
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

  it("tracks system theme changes", async () => {
    const mql = createMatchMedia(true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
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
    const mql = createMatchMedia(true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
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

    await flushAsyncWork();

    expect(setIconMock).toHaveBeenCalledTimes(1);
  });

  it("removes the system theme listener when switching to an explicit theme", async () => {
    const mql = createMatchMedia(true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
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

    await flushAsyncWork();

    expect(setIconMock).toHaveBeenCalledTimes(callsAfterExplicitTheme);
  });

  it("skips runtime icon replacement when capability is disabled", async () => {
    const mql = createMatchMedia(true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      kind: "macos",
      supportsRuntimeWindowIconReplacement: false,
    });

    render(<HookHarness />);

    await flushAsyncWork();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("skips runtime icon replacement when platform info is not loaded", async () => {
    const mql = createMatchMedia(true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: false,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await flushAsyncWork();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("falls back without throwing when system theme cannot read matchMedia", async () => {
    vi.stubGlobal("matchMedia", undefined);
    usePreferencesStore.setState({ prefs: { theme: "system" }, loaded: true });
    setPlatformState({
      loaded: true,
      supportsRuntimeWindowIconReplacement: true,
    });

    expect(() => render(<HookHarness />)).not.toThrow();

    await flushAsyncWork();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("uses legacy system theme listeners and ignores cleanup failures", async () => {
    const mql = createLegacyMatchMedia(true, { throwOnRemove: true });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
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
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => createMatchMedia(false)),
    );
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    setPlatformState({
      loaded: false,
      supportsRuntimeWindowIconReplacement: true,
    });

    render(<HookHarness />);

    await flushAsyncWork();
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
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => createMatchMedia(false)),
    );
    setIconMock.mockRejectedValueOnce(new Error("runtime icon unavailable")).mockResolvedValue(undefined);
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
  });

  it("applies only the latest queued icon request after rapid theme changes", async () => {
    const firstIconRequest = createDeferred<void>();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => createMatchMedia(false)),
    );
    setIconMock.mockImplementationOnce(() => firstIconRequest.promise).mockResolvedValue(undefined);
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

    await flushAsyncWork();

    expect(setIconMock).toHaveBeenCalledTimes(1);

    act(() => {
      firstIconRequest.resolve();
    });

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledTimes(2);
      expect(setIconMock).toHaveBeenLastCalledWith("/icons/app-icon-light.png");
    });
  });

  it("does not replay a stale intermediate system theme request when the latest request matches the in-flight icon", async () => {
    const firstIconRequest = createDeferred<void>();
    const mql = createMatchMedia(true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
    setIconMock.mockImplementationOnce(() => firstIconRequest.promise).mockResolvedValue(undefined);
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

    await flushAsyncWork();

    expect(setIconMock).toHaveBeenCalledTimes(1);

    act(() => {
      firstIconRequest.resolve();
    });

    await flushAsyncWork();

    expect(setIconMock).toHaveBeenCalledTimes(1);
  });

  it("does not apply queued icon requests after unmount", async () => {
    const firstIconRequest = createDeferred<void>();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => createMatchMedia(false)),
    );
    setIconMock.mockImplementationOnce(() => firstIconRequest.promise).mockResolvedValue(undefined);
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

    await flushAsyncWork();
    unmount();

    act(() => {
      firstIconRequest.resolve();
    });
    await flushAsyncWork();

    expect(setIconMock).toHaveBeenCalledTimes(1);
  });
});
