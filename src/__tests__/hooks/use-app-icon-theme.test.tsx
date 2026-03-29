import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppIconTheme } from "@/hooks/use-app-icon-theme";
import { usePreferencesStore } from "@/stores/preferences-store";

const { setIconMock } = vi.hoisted(() => ({
  setIconMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setIcon: setIconMock,
  }),
}));

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

describe("useAppIconTheme", () => {
  beforeEach(() => {
    setIconMock.mockReset();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("uses the light icon when the theme is light", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => createMatchMedia(false)),
    );
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });

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

    render(<HookHarness />);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-dark.png");
    });

    mql.dispatch(false);

    await waitFor(() => {
      expect(setIconMock).toHaveBeenCalledWith("/icons/app-icon-light.png");
    });
  });
});
