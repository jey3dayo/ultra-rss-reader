import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleFeeds } from "@tests/helpers/fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useArticleBrowserOverlayDisplay } from "@/components/reader/hooks/article/use-article-browser-overlay-display";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

describe("useArticleBrowserOverlayDisplay", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({
      prefs: {
        reader_mode_default: "true",
        web_preview_mode_default: "false",
      },
    });
  });

  it("preserves a user-opened Web Preview session across article changes", () => {
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

    expect(result.current.shouldShowBrowserOverlay).toBe(true);
    expect(result.current.resolvedDisplay.webPreviewMode).toBe(true);
    expect(useUiStore.getState().webPreviewSessionMode).toBe("forced-on");
  });

  it("keeps a user-closed Web Preview session closed across article changes", () => {
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
      result.current.setBrowserOverlayClosedPreference();
    });
    rerender({ articleId: "art-2" });

    expect(result.current.shouldShowBrowserOverlay).toBe(false);
    expect(result.current.resolvedDisplay.webPreviewMode).toBe(false);
    expect(useUiStore.getState().webPreviewSessionMode).toBe("forced-off");
  });

  it("lets a user-opened Web Preview session override a feed-level standard display", () => {
    const { result, rerender } = renderHook(
      ({ articleId }: { articleId: string }) =>
        useArticleBrowserOverlayDisplay({
          articleId,
          articleUrl: "https://example.com/article",
          feed: { ...sampleFeeds[0], reader_mode: "on", web_preview_mode: "off" },
        }),
      { initialProps: { articleId: "art-1" } },
    );

    expect(result.current.shouldShowBrowserOverlay).toBe(false);

    act(() => {
      result.current.setBrowserOverlayOpenPreference();
    });
    expect(result.current.shouldShowBrowserOverlay).toBe(true);

    rerender({ articleId: "art-2" });

    expect(result.current.shouldShowBrowserOverlay).toBe(true);
    expect(result.current.resolvedDisplay.webPreviewMode).toBe(true);
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
