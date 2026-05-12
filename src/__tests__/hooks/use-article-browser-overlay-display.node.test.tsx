import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleFeeds } from "@tests/helpers/fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useArticleBrowserOverlayDisplay } from "@/components/reader/hooks/article/use-article-browser-overlay-display";
import { APP_EVENTS } from "@/constants/events";
import { usePreferencesStore } from "@/stores/preferences-store";

setupBrowserTestDom();

describe("useArticleBrowserOverlayDisplay", () => {
  afterEach(() => {
    cleanup();
  });

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

  it("keeps whitespace-only article URLs in missing web preview fallback", () => {
    usePreferencesStore.setState({
      prefs: {
        reader_mode_default: "true",
        web_preview_mode_default: "true",
      },
    });

    const { result } = renderHook(() =>
      useArticleBrowserOverlayDisplay({
        articleId: "art-blank-url",
        articleUrl: " \n\t ",
        feed: { ...sampleFeeds[0], reader_mode: "on", web_preview_mode: "on" },
      }),
    );

    expect(result.current.shouldShowBrowserOverlay).toBe(false);
    expect(result.current.resolvedDisplay.webPreviewMode).toBe(false);
    expect(result.current.resolvedDisplay.fallbackReason).toBe("missing_web_preview");

    act(() => {
      result.current.setBrowserOverlayOpenPreference();
    });

    expect(result.current.shouldShowBrowserOverlay).toBe(false);
    expect(result.current.resolvedDisplay.webPreviewMode).toBe(false);
    expect(result.current.resolvedDisplay.fallbackReason).toBe("missing_web_preview");
  });
});
