import { Result } from "@praha/byethrow";
import { useCallback, useEffect } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import { resolveArticleDisplay } from "@/lib/article-display";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import type { ContentMode } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";
import { useArticleBrowserOverlayDisplay } from "./use-article-browser-overlay-display";
import { useBrowserOverlayFocusReturn } from "./use-browser-overlay-focus-return";

type UseArticleBrowserOverlayParams = {
  articleId: string;
  articleUrl: string | null;
  browserUrl: string | null;
  contentMode: ContentMode;
  feed?: FeedDto;
};

type UseArticleBrowserOverlayResult = {
  isBrowserOpen: boolean;
  resolvedDisplay: ReturnType<typeof resolveArticleDisplay>;
  handleCloseBrowserOverlay: () => void;
  handleToggleBrowserOverlay: () => void;
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

  const finalizeCloseBrowserOverlay = useCallback(() => {
    useUiStore.getState().setFocusedPane("list");
    focusSelectedArticleRow();
    setBrowserOverlayClosedPreference();
    closeBrowser();
    requestAnimationFrame(() => {
      focusSelectedArticleRow();
      flushPendingBrowserCloseAction();
    });
  }, [closeBrowser, focusSelectedArticleRow, setBrowserOverlayClosedPreference]);

  const handleCloseBrowserOverlay = useCallback(() => {
    if (useUiStore.getState().browserCloseInFlight) {
      emitDebugInputTrace("close-browser ignored (in-flight)");
      return;
    }
    emitDebugInputTrace("close-browser start");
    setBrowserCloseInFlight(true);
    void closeBrowserWebview()
      .then((result) =>
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close embedded browser webview before returning to reader mode:", error);
          }),
        ),
      )
      .finally(() => {
        emitDebugInputTrace("close-browser finalize");
        finalizeCloseBrowserOverlay();
      });
  }, [finalizeCloseBrowserOverlay, setBrowserCloseInFlight]);

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
