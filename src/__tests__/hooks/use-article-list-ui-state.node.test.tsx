import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleListInteractions } from "@/components/reader/hooks/article-list/use-article-list-interactions";
import { useArticleListUiState } from "@/components/reader/hooks/article-list/use-article-list-ui-state";
import { buildKeyToActionMap } from "@/lib/keyboard/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";

setupBrowserTestDom();

describe("article-list preference subscriptions", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {} });
  });

  afterEach(() => {
    cleanup();
    usePreferencesStore.setState({ prefs: {} });
  });

  it("keeps the controller input and keyboard handler stable for unrelated preferences", () => {
    const actions = {
      openSearch: vi.fn(),
      handleMarkAllRead: vi.fn(),
    };
    const articles: Parameters<typeof useArticleListInteractions>[0]["filteredArticles"] = [];
    const { result } = renderHook(() => {
      const uiState = useArticleListUiState();
      const interactions = useArticleListInteractions({
        ...uiState,
        ...actions,
        filteredArticles: articles,
      });
      return { uiState, interactions };
    });
    const initial = result.current;

    act(() => {
      usePreferencesStore.setState({ prefs: { theme: "light", language: "ja", developer_mode: "true" } });
    });

    expect(result.current).toBe(initial);

    act(() => {
      usePreferencesStore.setState((state) => ({ prefs: { ...state.prefs, text_preview: "true" } }));
    });

    expect(result.current.uiState.textPreview).toBe("true");
    expect(result.current.uiState.keyboardPrefs).toBe(initial.uiState.keyboardPrefs);
    expect(result.current.interactions.handleListKeyDownCapture).toBe(initial.interactions.handleListKeyDownCapture);

    act(() => {
      usePreferencesStore.setState((state) => ({ prefs: { ...state.prefs, shortcut_next_article: "q" } }));
    });

    expect(result.current.interactions.handleListKeyDownCapture).not.toBe(
      initial.interactions.handleListKeyDownCapture,
    );
    expect(buildKeyToActionMap(result.current.uiState.keyboardPrefs).get("q")).toBe("next_article");
  });

  it("preserves shortcut conflicts and legacy renamed shortcut preferences", () => {
    const { result } = renderHook(useArticleListUiState);

    act(() => {
      usePreferencesStore.setState({ prefs: { shortcut_view_in_browser: "q" } });
    });
    expect(buildKeyToActionMap(result.current.keyboardPrefs).get("q")).toBe("open_in_app_browser");

    act(() => {
      usePreferencesStore.setState({ prefs: { shortcut_next_article: "q", shortcut_toggle_sidebar: "q" } });
    });
    expect(buildKeyToActionMap(result.current.keyboardPrefs).has("q")).toBe(false);
  });
});
