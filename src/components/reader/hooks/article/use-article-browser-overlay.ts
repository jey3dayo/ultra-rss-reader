import { useCallback, useEffect, useRef } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { useArticleBrowserOverlayClose } from "@/components/reader/hooks/article/use-article-browser-overlay-close";
import { useArticleBrowserOverlayDisplay } from "@/components/reader/hooks/article/use-article-browser-overlay-display";
import { useBrowserOverlayFocusReturn } from "@/components/reader/hooks/browser/use-browser-overlay-focus-return";
import type { ResolvedArticleDisplay } from "@/lib/articles/article-display";
import type { ContentMode } from "@/lib/layout/layout-state.types";
import { useUiStore } from "@/stores/ui-store";

type UseArticleBrowserOverlayParams = {
  articleId: string;
  articleUrl: string | null;
  browserUrl: string | null;
  contentMode: ContentMode;
  feed?: FeedDto;
};

type UseArticleBrowserOverlayResult = {
  isBrowserOpen: boolean;
  resolvedDisplay: ResolvedArticleDisplay;
  handleOpenBrowserOverlay: () => void;
  handleCloseBrowserOverlay: () => void;
  handleBrowserWebviewClosed: () => void;
  handleToggleBrowserOverlay: () => void;
};

export function useArticleBrowserOverlay({
  articleId,
  articleUrl,
  contentMode,
  feed,
}: UseArticleBrowserOverlayParams): UseArticleBrowserOverlayResult {
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const browserArticleId = useUiStore((s) => s.browserArticleId);
  const setBrowserCloseInFlight = useUiStore((s) => s.setBrowserCloseInFlight);
  const isBrowserOpen = contentMode === "browser";
  const suppressBrowserReopenRef = useRef(false);
  const previousSyncRef = useRef<{ articleId: string; articleUrl: string | null; show: boolean } | null>(null);
  const {
    resolvedDisplay,
    shouldShowBrowserOverlay,
    setBrowserOverlayOpenPreference,
    setBrowserOverlayClosedPreference,
  } = useArticleBrowserOverlayDisplay({
    articleId,
    articleUrl,
    feed,
  });
  const { focusSelectedArticleRow, rememberOverlayFocusReturnTarget } = useBrowserOverlayFocusReturn({
    articleId,
    isBrowserOpen,
  });

  useEffect(() => {
    const previous = previousSyncRef.current;
    const articleChanged =
      (previous !== null && (previous.articleId !== articleId || previous.articleUrl !== articleUrl)) ||
      (previous === null && isBrowserOpen && browserArticleId !== articleId);
    const displayChanged = previous !== null && previous.show !== shouldShowBrowserOverlay;
    previousSyncRef.current = { articleId, articleUrl, show: shouldShowBrowserOverlay };

    if (previous !== null && !articleChanged && !displayChanged) {
      return;
    }

    if (!shouldShowBrowserOverlay) {
      suppressBrowserReopenRef.current = false;
      if (isBrowserOpen && (articleChanged || displayChanged)) {
        closeBrowser();
      }
      return;
    }

    if (!articleUrl || (suppressBrowserReopenRef.current && !isBrowserOpen)) {
      return;
    }

    if (articleChanged || !isBrowserOpen) {
      if (!isBrowserOpen) {
        rememberOverlayFocusReturnTarget();
      }
      openBrowser(articleUrl);
    }
  }, [
    articleId,
    articleUrl,
    browserArticleId,
    closeBrowser,
    isBrowserOpen,
    openBrowser,
    rememberOverlayFocusReturnTarget,
    shouldShowBrowserOverlay,
  ]);

  const handleOpenBrowserOverlay = useCallback(() => {
    suppressBrowserReopenRef.current = false;
    rememberOverlayFocusReturnTarget();
    setBrowserOverlayOpenPreference();
    if (articleUrl) {
      openBrowser(articleUrl);
    }
  }, [articleUrl, openBrowser, rememberOverlayFocusReturnTarget, setBrowserOverlayOpenPreference]);

  const handleClosedBrowserOverlayPreference = useCallback(() => {
    suppressBrowserReopenRef.current = true;
    setBrowserOverlayClosedPreference();
  }, [setBrowserOverlayClosedPreference]);

  const { closeBrowserOverlay: handleCloseBrowserOverlay, finalizeClosedBrowserOverlay: handleBrowserWebviewClosed } =
    useArticleBrowserOverlayClose({
      closeBrowser,
      focusSelectedArticleRow,
      setBrowserCloseInFlight,
      setBrowserOverlayClosedPreference: handleClosedBrowserOverlayPreference,
    });

  const handleToggleBrowserOverlay = useCallback(() => {
    if (isBrowserOpen) {
      handleCloseBrowserOverlay();
      return;
    }

    handleOpenBrowserOverlay();
  }, [handleCloseBrowserOverlay, handleOpenBrowserOverlay, isBrowserOpen]);

  return {
    isBrowserOpen,
    resolvedDisplay,
    handleOpenBrowserOverlay,
    handleCloseBrowserOverlay,
    handleBrowserWebviewClosed,
    handleToggleBrowserOverlay,
  };
}
