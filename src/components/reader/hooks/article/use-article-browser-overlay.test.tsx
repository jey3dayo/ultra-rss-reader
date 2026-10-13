import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleBrowserOverlay } from "@/components/reader/hooks/article/use-article-browser-overlay";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/lib/browser/close-browser-webview-before-reader-mode", () => ({
  closeBrowserWebviewBeforeReaderMode: () => Promise.resolve(),
}));

function useOverlay(articleId: string, articleUrl: string | null) {
  const contentMode = useUiStore((state) => state.contentMode);
  return useArticleBrowserOverlay({ articleId, articleUrl, contentMode });
}

describe("article preview navigation intent", () => {
  beforeEach(() => {
    useUiStore.setState({ ...useUiStore.getInitialState(), selectedArticleId: "article-1", contentMode: "reader" });
    usePreferencesStore.setState({ prefs: { web_preview_mode_default: "false" } });
  });

  it.each(["true", "false"])("keeps an intentionally opened URL when preview default is %s", (preview) => {
    usePreferencesStore.setState({ prefs: { web_preview_mode_default: preview } });
    renderHook(() => useOverlay("article-1", "https://example.com/article"));
    act(() => useUiStore.getState().openBrowser("https://other.example.com/content"));
    expect(useUiStore.getState().browserUrl).toBe("https://other.example.com/content");
    expect(useUiStore.getState().contentMode).toBe("browser");
  });

  it.each(["true", "false"])(
    "preserves an existing same-article intent when the pane mounts with preview default %s",
    (preview) => {
      usePreferencesStore.setState({ prefs: { web_preview_mode_default: preview } });
      useUiStore.getState().openBrowser("https://other.example.com/intentional");
      renderHook(() => useOverlay("article-1", "https://example.com/article"));
      expect(useUiStore.getState().browserUrl).toBe("https://other.example.com/intentional");
      expect(useUiStore.getState().contentMode).toBe("browser");
    },
  );

  it("opens the initial publisher preview and follows article changes instead of pinning its previous URL", () => {
    usePreferencesStore.setState({ prefs: { web_preview_mode_default: "true" } });
    const { rerender } = renderHook(({ id, url }) => useOverlay(id, url), {
      initialProps: { id: "article-1", url: "https://example.com/article" },
    });
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/article");
    act(() => useUiStore.getState().openBrowser("https://other.example.com/content"));
    rerender({ id: "article-2", url: "https://example.com/next" });
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/next");
  });

  it("applies display preference changes but preserves URL changes within the same article", () => {
    renderHook(() => useOverlay("article-1", "https://example.com/article"));
    act(() => usePreferencesStore.setState({ prefs: { web_preview_mode_default: "true" } }));
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/article");
    act(() => useUiStore.getState().openBrowser("https://other.example.com/content"));
    act(() => usePreferencesStore.setState({ prefs: { web_preview_mode_default: "false" } }));
    expect(useUiStore.getState().contentMode).toBe("reader");
  });

  it("explicit close finalizes focus immediately, stays closed, and toggle opens the publisher again", () => {
    const row = document.createElement("button");
    row.dataset.articleId = "article-1";
    document.body.append(row);
    const { result } = renderHook(() => useOverlay("article-1", "http://localhost/publisher"));
    act(() => result.current.handleOpenBrowserOverlay());
    expect(useUiStore.getState().browserUrl).toBe("http://localhost/publisher");
    act(() => useUiStore.getState().openBrowser("https://other.example.com/content"));
    act(() => result.current.handleToggleBrowserOverlay());
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().webPreviewSessionMode).toBe("forced-off");
    expect(useUiStore.getState().focusedPane).toBe("list");
    expect(document.activeElement).toBe(row);
    act(() => result.current.handleToggleBrowserOverlay());
    expect(useUiStore.getState().browserUrl).toBe("http://localhost/publisher");
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
    row.remove();
  });

  it("closes the previous preview when the next article has no preview URL", () => {
    usePreferencesStore.setState({ prefs: { web_preview_mode_default: "true" } });
    const { rerender } = renderHook<ReturnType<typeof useOverlay>, { url: string | null }>(
      ({ url }) => useOverlay("article-1", url),
      {
        initialProps: { url: "https://example.com/article" },
      },
    );
    rerender({ url: null });
    expect(useUiStore.getState().contentMode).toBe("reader");
  });
});
