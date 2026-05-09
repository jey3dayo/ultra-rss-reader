import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useArticleViewUiState } from "@/components/reader/hooks/article/use-article-view-ui-state";
import { useCommandPaletteUiState } from "@/components/reader/hooks/command-palette/use-command-palette-ui-state";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

describe("reader UI state hooks", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("keeps article view public return names while reading the shared UI store slice", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      contentMode: "browser",
      browserUrl: "https://example.com/article",
      viewMode: "starred",
    });
    usePreferencesStore.setState({
      prefs: { after_reading: "after_1s" },
      loaded: true,
    });

    const { result } = renderHook(() => useArticleViewUiState());

    expect(result.current.contentMode).toBe("browser");
    expect(result.current.browserUrl).toBe("https://example.com/article");
    expect(result.current.viewMode).toBe("starred");
    expect(result.current.afterReading).toBe("after_1s");
    expect(result.current.closeBrowser).toBe(useUiStore.getState().closeBrowser);
    expect(result.current.clearArticle).toBe(useUiStore.getState().clearArticle);

    act(() => {
      result.current.closeBrowser();
    });

    expect(result.current.contentMode).toBe("empty");
    expect(result.current.browserUrl).toBeNull();
  });

  it("keeps command palette public return names while reading the shared UI store slice", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      commandPaletteOpen: true,
      selectedAccountId: "acc-1",
      syncProgress: {
        ...useUiStore.getInitialState().syncProgress,
        active: true,
      },
    });
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: true,
          supports_background_browser_open: true,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
    });
    usePreferencesStore.setState({
      prefs: { shortcut_open_command_palette: "Meta+K" },
      loaded: true,
    });

    const { result } = renderHook(() => useCommandPaletteUiState());

    expect(result.current.open).toBe(true);
    expect(result.current.selectedAccountId).toBe("acc-1");
    expect(result.current.isSyncing).toBe(true);
    expect(result.current.platformKind).toBe("macos");
    expect(result.current.shortcutPrefs).toEqual({
      shortcut_open_command_palette: "Meta+K",
    });
    expect(result.current.closeCommandPalette).toBe(useUiStore.getState().closeCommandPalette);
    expect(result.current.selectArticle).toBe(useUiStore.getState().selectArticle);

    act(() => {
      result.current.closeCommandPalette();
    });

    expect(result.current.open).toBe(false);
  });
});
