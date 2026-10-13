import { useCallback, useEffect, useRef, useState } from "react";
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
  handleOpenLinkInBrowser: (url: string) => void;
};

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
  const suppressBrowserReopenRef = useRef(false);
  const [linkBrowserTarget, setLinkBrowserTarget] = useState<{ articleId: string; url: string } | null>(null);
  const linkBrowserUrl = linkBrowserTarget?.articleId === articleId ? linkBrowserTarget.url : null;
  const isLinkBrowserActive = Boolean(linkBrowserUrl && isBrowserOpen && browserUrl === linkBrowserUrl);
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
    if (isLinkBrowserActive) {
      return;
    }

    if (!articleUrl) {
      if (isBrowserOpen) {
        closeBrowser();
      }
      return;
    }

    if (!shouldShowBrowserOverlay) {
      suppressBrowserReopenRef.current = false;
    }

    if (shouldShowBrowserOverlay) {
      if (suppressBrowserReopenRef.current && !isBrowserOpen) {
        return;
      }
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
    isLinkBrowserActive,
    openBrowser,
    rememberOverlayFocusReturnTarget,
    shouldShowBrowserOverlay,
  ]);

  const handleOpenBrowserOverlay = useCallback(() => {
    suppressBrowserReopenRef.current = false;
    setLinkBrowserTarget(null);
    rememberOverlayFocusReturnTarget();
    setBrowserOverlayOpenPreference();
  }, [rememberOverlayFocusReturnTarget, setBrowserOverlayOpenPreference]);

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

  const handleOpenLinkInBrowser = useCallback(
    (url: string) => {
      setLinkBrowserTarget({ articleId, url });
      openBrowser(url);
    },
    [articleId, openBrowser],
  );

  const handleToggleBrowserOverlay = useCallback(() => {
    if (isLinkBrowserActive || requestedDisplay.webPreviewMode) {
      handleCloseBrowserOverlay();
      return;
    }

    handleOpenBrowserOverlay();
  }, [handleCloseBrowserOverlay, handleOpenBrowserOverlay, isLinkBrowserActive, requestedDisplay.webPreviewMode]);

  return {
    handleOpenLinkInBrowser,
    isBrowserOpen,
    resolvedDisplay,
    handleOpenBrowserOverlay,
    handleCloseBrowserOverlay,
    handleBrowserWebviewClosed,
    handleToggleBrowserOverlay,
  };
}
