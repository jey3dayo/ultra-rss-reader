import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import {
  type BinaryDisplayMode,
  resolveAppDefaultDisplayModes,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { usePreferencesStore } from "@/stores/preferences-store";

type UseArticleBrowserOverlayDisplayParams = {
  articleId: string;
  articleUrl: string | null;
  feed?: FeedDto;
};

export function useArticleBrowserOverlayDisplay({
  articleId,
  articleUrl,
  feed,
}: UseArticleBrowserOverlayDisplayParams) {
  const prefs = usePreferencesStore((s) => s.prefs);
  const [readerModeOverride, setReaderModeOverride] = useState<BinaryDisplayMode | null>(null);
  const [webPreviewModeOverride, setWebPreviewModeOverride] = useState<BinaryDisplayMode | null>(null);
  const preserveBrowserOverlayOnNextArticleRef = useRef(false);
  const previousArticleIdRef = useRef(articleId);

  const appDefaultDisplayModes = useMemo(() => resolveAppDefaultDisplayModes(prefs), [prefs]);
  const feedDisplayOverrides = useMemo(() => resolveFeedDisplayOverrides(feed), [feed]);
  const temporaryOverride = useMemo(
    () => ({ readerMode: readerModeOverride, webPreviewMode: webPreviewModeOverride }),
    [readerModeOverride, webPreviewModeOverride],
  );

  const requestedDisplay = useMemo(
    () =>
      resolveArticleDisplay({
        appDefault: appDefaultDisplayModes,
        feedOverride: feedDisplayOverrides,
        temporaryOverride,
        articleCapabilities: { hasWebPreview: true },
      }),
    [appDefaultDisplayModes, feedDisplayOverrides, temporaryOverride],
  );

  const resolvedDisplay = useMemo(
    () =>
      resolveArticleDisplay({
        appDefault: appDefaultDisplayModes,
        feedOverride: feedDisplayOverrides,
        temporaryOverride,
        articleCapabilities: { hasWebPreview: Boolean(articleUrl) },
      }),
    [appDefaultDisplayModes, articleUrl, feedDisplayOverrides, temporaryOverride],
  );

  const shouldShowBrowserOverlay = Boolean(articleUrl) && resolvedDisplay.webPreviewMode;

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

  const setBrowserOverlayOpenPreference = useCallback(() => {
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("on");
  }, [requestedDisplay.readerMode]);

  const setBrowserOverlayClosedPreference = useCallback(() => {
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("off");
  }, [requestedDisplay.readerMode]);

  return {
    requestedDisplay,
    resolvedDisplay,
    shouldShowBrowserOverlay,
    setBrowserOverlayOpenPreference,
    setBrowserOverlayClosedPreference,
  } as const;
}
