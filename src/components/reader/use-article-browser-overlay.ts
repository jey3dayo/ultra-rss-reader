import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import {
  type BinaryDisplayMode,
  resolveAppDefaultDisplayModes,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { ContentMode } from "@/stores/ui-store";
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
  const prefs = usePreferencesStore((s) => s.prefs);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const setBrowserCloseInFlight = useUiStore((s) => s.setBrowserCloseInFlight);
  const [readerModeOverride, setReaderModeOverride] = useState<BinaryDisplayMode | null>(null);
  const [webPreviewModeOverride, setWebPreviewModeOverride] = useState<BinaryDisplayMode | null>(null);
  const overlayFocusReturnTargetRef = useRef<HTMLElement | null>(null);
  const overlayFocusReturnTargetKeyRef = useRef<string | null>(null);
  const preserveBrowserOverlayOnNextArticleRef = useRef(false);
  const previousArticleIdRef = useRef(articleId);
  const wasBrowserOpenRef = useRef(false);
  const isBrowserOpen = contentMode === "browser";
  const requestedDisplay = resolveArticleDisplay({
    appDefault: resolveAppDefaultDisplayModes(prefs),
    feedOverride: resolveFeedDisplayOverrides(feed),
    temporaryOverride: { readerMode: readerModeOverride, webPreviewMode: webPreviewModeOverride },
    articleCapabilities: { hasWebPreview: true },
  });
  const resolvedDisplay = resolveArticleDisplay({
    appDefault: resolveAppDefaultDisplayModes(prefs),
    feedOverride: resolveFeedDisplayOverrides(feed),
    temporaryOverride: { readerMode: readerModeOverride, webPreviewMode: webPreviewModeOverride },
    articleCapabilities: { hasWebPreview: Boolean(articleUrl) },
  });
  const shouldShowBrowserOverlay = Boolean(articleUrl) && resolvedDisplay.webPreviewMode;

  const focusSelectedArticleRow = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${articleId}"]`);
    if (!selectedArticleTarget || selectedArticleTarget.hasAttribute("disabled")) {
      return;
    }

    useUiStore.getState().setFocusedPane("list");
    selectedArticleTarget.focus({ preventScroll: true });
  }, [articleId]);

  useEffect(() => {
    const markKeyboardNavigationIntent = () => {
      preserveBrowserOverlayOnNextArticleRef.current = webPreviewModeOverride === "on";
    };

    window.addEventListener(APP_EVENTS.navigateArticle, markKeyboardNavigationIntent);
    return () => {
      window.removeEventListener(APP_EVENTS.navigateArticle, markKeyboardNavigationIntent);
    };
  }, [webPreviewModeOverride]);

  useEffect(() => {
    if (previousArticleIdRef.current === articleId) {
      return;
    }

    previousArticleIdRef.current = articleId;
    const shouldPreserveBrowserOverlay =
      webPreviewModeOverride === "on" && preserveBrowserOverlayOnNextArticleRef.current;
    preserveBrowserOverlayOnNextArticleRef.current = false;
    if (shouldPreserveBrowserOverlay) {
      return;
    }
    setReaderModeOverride(null);
    setWebPreviewModeOverride(null);
  }, [articleId, webPreviewModeOverride]);

  const rememberOverlayFocusReturnTarget = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || activeElement === document.body) {
      return;
    }

    overlayFocusReturnTargetRef.current = activeElement;
    overlayFocusReturnTargetKeyRef.current = activeElement.getAttribute("data-browser-overlay-return-focus");
  }, []);

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

  useEffect(() => {
    if (wasBrowserOpenRef.current && !isBrowserOpen && typeof document !== "undefined") {
      const previousTarget = overlayFocusReturnTargetRef.current;
      const previousTargetKey = overlayFocusReturnTargetKeyRef.current;
      overlayFocusReturnTargetRef.current = null;
      overlayFocusReturnTargetKeyRef.current = null;

      requestAnimationFrame(() => {
        const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${articleId}"]`);
        if (selectedArticleTarget && !selectedArticleTarget.hasAttribute("disabled")) {
          useUiStore.getState().setFocusedPane("list");
          selectedArticleTarget.focus({ preventScroll: true });
          return;
        }

        if (previousTargetKey) {
          const nextTarget = document.querySelector<HTMLElement>(
            `[data-browser-overlay-return-focus="${previousTargetKey}"]`,
          );
          if (nextTarget && !nextTarget.hasAttribute("disabled")) {
            nextTarget.focus();
            return;
          }
        }

        if (previousTarget?.isConnected && !previousTarget.hasAttribute("disabled")) {
          previousTarget.focus();
          return;
        }

        document.querySelector<HTMLElement>('[data-browser-overlay-return-focus="open-in-browser"]')?.focus();
      });
    }

    wasBrowserOpenRef.current = isBrowserOpen;
  }, [articleId, isBrowserOpen]);

  const handleOpenBrowserOverlay = useCallback(() => {
    rememberOverlayFocusReturnTarget();
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("on");
  }, [rememberOverlayFocusReturnTarget, requestedDisplay.readerMode]);

  const finalizeCloseBrowserOverlay = useCallback(() => {
    useUiStore.getState().setFocusedPane("list");
    focusSelectedArticleRow();
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("off");
    closeBrowser();
    requestAnimationFrame(() => {
      focusSelectedArticleRow();
      flushPendingBrowserCloseAction();
    });
  }, [closeBrowser, focusSelectedArticleRow, requestedDisplay.readerMode]);

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
