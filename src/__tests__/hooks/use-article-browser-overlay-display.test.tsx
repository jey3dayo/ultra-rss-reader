import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useArticleBrowserOverlayDisplay } from "@/components/reader/hooks/article/use-article-browser-overlay-display";
import { APP_EVENTS } from "@/constants/events";
import { usePreferencesStore } from "@/stores/preferences-store";

describe("useArticleBrowserOverlayDisplay", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      prefs: {
        reader_mode_default: "true",
        web_preview_mode_default: "false",
      },
    });
  });

  it("preserves a transient Web Preview override for keyboard article navigation", () => {
    const { result, rerender } = renderHook(
      ({ articleId }: { articleId: string }) =>
        useArticleBrowserOverlayDisplay({
          articleId,
          articleUrl: "https://example.com/article",
          feed: undefined,
        }),
      { initialProps: { articleId: "art-1" } },
    );

    act(() => {
      result.current.setBrowserOverlayOpenPreference();
    });
    expect(result.current.shouldShowBrowserOverlay).toBe(true);

    act(() => {
      window.dispatchEvent(new Event(APP_EVENTS.navigateArticle));
    });
    rerender({ articleId: "art-2" });

    expect(result.current.shouldShowBrowserOverlay).toBe(true);
    expect(result.current.resolvedDisplay.webPreviewMode).toBe(true);
  });

  it("resets a transient Web Preview override for non-keyboard article changes", () => {
    const { result, rerender } = renderHook(
      ({ articleId }: { articleId: string }) =>
        useArticleBrowserOverlayDisplay({
          articleId,
          articleUrl: "https://example.com/article",
          feed: undefined,
        }),
      { initialProps: { articleId: "art-1" } },
    );

    act(() => {
      result.current.setBrowserOverlayOpenPreference();
    });
    expect(result.current.shouldShowBrowserOverlay).toBe(true);

    rerender({ articleId: "art-2" });

    expect(result.current.shouldShowBrowserOverlay).toBe(false);
    expect(result.current.resolvedDisplay.webPreviewMode).toBe(false);
  });
});
