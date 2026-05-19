import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import {
  type BinaryDisplayMode,
  type ResolvedArticleDisplay,
  resolveAppDefaultDisplayModes,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
} from "@/lib/articles/article-display";
import { hasWebPreviewUrl } from "@/lib/feed/feed-landing";
import { bindWindowEvents } from "@/lib/window/window-events";
import { usePreferencesStore } from "@/stores/preferences-store";

type UseArticleBrowserOverlayDisplayParams = {
  articleId: string;
  articleUrl: string | null;
  feed?: FeedDto;
};

type UseArticleBrowserOverlayDisplayResult = {
  requestedDisplay: ResolvedArticleDisplay;
  resolvedDisplay: ResolvedArticleDisplay;
  shouldShowBrowserOverlay: boolean;
  setBrowserOverlayOpenPreference: () => void;
  setBrowserOverlayClosedPreference: () => void;
};

export function useArticleBrowserOverlayDisplay({
  articleId,
  articleUrl,
  feed,
}: UseArticleBrowserOverlayDisplayParams): UseArticleBrowserOverlayDisplayResult {
  const prefs = usePreferencesStore((s) => s.prefs);
  const [readerModeOverride, setReaderModeOverride] = useState<BinaryDisplayMode | null>(null);
  const [webPreviewModeOverride, setWebPreviewModeOverride] = useState<BinaryDisplayMode | null>(null);
  const preserveBrowserOverlayOnNextArticleRef = useRef(false);
  const suppressBrowserOverlayPreserveRef = useRef(false);
  const previousArticleIdRef = useRef(articleId);

  const appDefaultDisplayModes = useMemo(() => resolveAppDefaultDisplayModes(prefs), [prefs]);
  const feedDisplayOverrides = useMemo(() => resolveFeedDisplayOverrides(feed), [feed]);
  const temporaryOverride = useMemo(
    () => ({
      readerMode: readerModeOverride,
      webPreviewMode: webPreviewModeOverride,
    }),
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
        articleCapabilities: { hasWebPreview: hasWebPreviewUrl(articleUrl) },
      }),
    [appDefaultDisplayModes, articleUrl, feedDisplayOverrides, temporaryOverride],
  );

  const shouldShowBrowserOverlay = hasWebPreviewUrl(articleUrl) && resolvedDisplay.webPreviewMode;

  useEffect(() => {
    const markKeyboardNavigationIntent = () => {
      if (suppressBrowserOverlayPreserveRef.current) {
        preserveBrowserOverlayOnNextArticleRef.current = false;
        return;
      }
      preserveBrowserOverlayOnNextArticleRef.current = webPreviewModeOverride === "on";
    };

    return bindWindowEvents([
      {
        type: APP_EVENTS.navigateArticle,
        listener: markKeyboardNavigationIntent,
      },
    ]);
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
    suppressBrowserOverlayPreserveRef.current = false;
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("on");
  }, [requestedDisplay.readerMode]);

  const setBrowserOverlayClosedPreference = useCallback(() => {
    suppressBrowserOverlayPreserveRef.current = true;
    preserveBrowserOverlayOnNextArticleRef.current = false;
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("off");
  }, [requestedDisplay.readerMode]);

  return {
    requestedDisplay,
    resolvedDisplay,
    shouldShowBrowserOverlay,
    setBrowserOverlayOpenPreference,
    setBrowserOverlayClosedPreference,
  };
}
