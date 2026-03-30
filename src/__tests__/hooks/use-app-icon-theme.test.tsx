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

function createMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  return {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatch(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches: nextMatches } as MediaQueryListEvent;
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
    setPlatformState({ loaded: true, supportsRuntimeWindowIconReplacement: true });

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
    setPlatformState({ loaded: true, supportsRuntimeWindowIconReplacement: true });

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });

    mql.dispatch(false);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });
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
    setPlatformState({ loaded: false, supportsRuntimeWindowIconReplacement: true });

    render(<HookHarness />);

    await flushAsyncWork();

    expect(setIconMock).not.toHaveBeenCalled();
  });

  it("applies icon after platform info loads and runtime replacement becomes available", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => createMatchMedia(false)),
    );
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });
    setPlatformState({ loaded: false, supportsRuntimeWindowIconReplacement: true });

    render(<HookHarness />);

    await flushAsyncWork();
    expect(setIconMock).not.toHaveBeenCalled();

    act(() => {
      setPlatformState({ loaded: true, supportsRuntimeWindowIconReplacement: true });
    });

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });
  });
});
