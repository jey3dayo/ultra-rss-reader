import { useCallback, useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";
import type { UseArticleBrowserOverlayParams, UseArticleBrowserOverlayResult } from "./article-view.types";
import { useArticleBrowserOverlayClose } from "./use-article-browser-overlay-close";
import { useArticleBrowserOverlayDisplay } from "./use-article-browser-overlay-display";
import { useBrowserOverlayFocusReturn } from "./use-browser-overlay-focus-return";

export function useArticleBrowserOverlay({
  articleId,
  articleUrl,
  browserUrl,
  contentMode,
  feed,
}: UseArticleBrowserOverlayParams): UseArticleBrowserOverlayResult {
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const setBrowserCloseInFlight = useUiStore((s) => s.setBrowserCloseInFlight);
  const isBrowserOpen = contentMode === "browser";
  const {
    requestedDisplay,
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
    if (!articleUrl) {
      if (isBrowserOpen) {
        closeBrowser();
      }
      return;
    }

    if (shouldShowBrowserOverlay) {
      if (!isBrowserOpen || browserUrl !== articleUrl) {
        if (!isBrowserOpen) {
          rememberOverlayFocusReturnTarget();
        }
        openBrowser(articleUrl);
      }
      return;
    }

    if (isBrowserOpen) {
      closeBrowser();
    }
  }, [
    articleUrl,
    browserUrl,
    closeBrowser,
    isBrowserOpen,
    openBrowser,
    rememberOverlayFocusReturnTarget,
    shouldShowBrowserOverlay,
  ]);

  const handleOpenBrowserOverlay = useCallback(() => {
    rememberOverlayFocusReturnTarget();
    setBrowserOverlayOpenPreference();
  }, [rememberOverlayFocusReturnTarget, setBrowserOverlayOpenPreference]);

  const handleCloseBrowserOverlay = useArticleBrowserOverlayClose({
    closeBrowser,
    focusSelectedArticleRow,
    setBrowserCloseInFlight,
    setBrowserOverlayClosedPreference,
  });

  const handleToggleBrowserOverlay = useCallback(() => {
    if (requestedDisplay.webPreviewMode) {
      handleCloseBrowserOverlay();
      return;
    }

    handleOpenBrowserOverlay();
  }, [handleCloseBrowserOverlay, handleOpenBrowserOverlay, requestedDisplay.webPreviewMode]);

  return {
    isBrowserOpen,
    resolvedDisplay,
    handleCloseBrowserOverlay,
    handleToggleBrowserOverlay,
  };
}
