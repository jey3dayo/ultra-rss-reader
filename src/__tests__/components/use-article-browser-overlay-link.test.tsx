import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useArticleBrowserOverlay } from "@/components/reader/hooks/article/use-article-browser-overlay";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const articleUrl = "https://example.com/articles/source";
const linkUrl = "https://example.com/posts/1";
const otherArticleUrl = "https://example.com/articles/other";

type OverlayProps = { articleId: string; articleUrl: string };

function renderOverlayHook(initial: OverlayProps) {
  return renderHook(
    ({ articleId, articleUrl: currentArticleUrl }: OverlayProps) => {
      const browserUrl = useUiStore((s) => s.browserUrl);
      const contentMode = useUiStore((s) => s.contentMode);
      return useArticleBrowserOverlay({ articleId, articleUrl: currentArticleUrl, browserUrl, contentMode });
    },
    { initialProps: initial },
  );
}

describe("useArticleBrowserOverlay content links", () => {
  beforeEach(() => {
    useUiStore.setState({ ...useUiStore.getInitialState(), contentMode: "reader", selectedArticleId: "art-1" });
    usePreferencesStore.setState({
      prefs: { open_links: "in_app", reader_mode_default: "true", web_preview_mode_default: "false" },
      loaded: true,
    });
  });

  it("keeps a content link open in the in-app browser when the article's web preview is off", () => {
    const { result } = renderOverlayHook({ articleId: "art-1", articleUrl });

    act(() => {
      result.current.handleOpenLinkInBrowser(linkUrl);
    });

    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe(linkUrl);
  });

  it("returns to the article URL when the title opens the web preview after a content link", () => {
    const { result } = renderOverlayHook({ articleId: "art-1", articleUrl });

    act(() => {
      result.current.handleOpenLinkInBrowser(linkUrl);
    });
    act(() => {
      result.current.handleOpenBrowserOverlay();
    });

    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe(articleUrl);
  });

  it("keeps a content link open while the article web preview is forced on", () => {
    useUiStore.setState({ webPreviewSessionMode: "forced-on" });
    const { result, rerender } = renderOverlayHook({ articleId: "art-1", articleUrl });

    act(() => {
      result.current.handleOpenLinkInBrowser(linkUrl);
    });
    rerender({ articleId: "art-1", articleUrl });

    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe(linkUrl);
  });

  it("closes a content link browser when the selected article changes", () => {
    const { result, rerender } = renderOverlayHook({ articleId: "art-1", articleUrl });

    act(() => {
      result.current.handleOpenLinkInBrowser(linkUrl);
    });
    rerender({ articleId: "art-2", articleUrl: otherArticleUrl });

    expect(useUiStore.getState().contentMode).toBe("reader");
  });

  it("closes a content link browser when the toggle is pressed while it is open", () => {
    const { result } = renderOverlayHook({ articleId: "art-1", articleUrl });

    act(() => {
      result.current.handleOpenLinkInBrowser(linkUrl);
    });
    act(() => {
      result.current.handleToggleBrowserOverlay();
    });

    expect(useUiStore.getState().contentMode).toBe("reader");
  });

  it("does not keep a stale content link target when returning to its article after another article showed the web preview", () => {
    const { result, rerender } = renderOverlayHook({ articleId: "art-1", articleUrl });

    act(() => {
      result.current.handleOpenLinkInBrowser(linkUrl);
    });

    useUiStore.setState({ webPreviewSessionMode: "forced-on" });
    rerender({ articleId: "art-2", articleUrl: otherArticleUrl });
    expect(useUiStore.getState().browserUrl).toBe(otherArticleUrl);

    useUiStore.setState({ webPreviewSessionMode: "forced-off" });
    rerender({ articleId: "art-1", articleUrl });

    expect(useUiStore.getState().contentMode).toBe("reader");
  });
});
