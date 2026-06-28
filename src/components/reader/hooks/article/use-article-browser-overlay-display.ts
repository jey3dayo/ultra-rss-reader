import { useCallback, useMemo } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import {
  type ResolvedArticleDisplay,
  resolveAppDefaultDisplayModes,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
  webPreviewSessionModeToOverride,
} from "@/lib/articles/article-display";
import { hasWebPreviewUrl } from "@/lib/feed/feed-landing";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

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
  articleUrl,
  feed,
}: UseArticleBrowserOverlayDisplayParams): UseArticleBrowserOverlayDisplayResult {
  const prefs = usePreferencesStore((s) => s.prefs);
  const webPreviewSessionMode = useUiStore((s) => s.webPreviewSessionMode);
  const setWebPreviewSessionMode = useUiStore((s) => s.setWebPreviewSessionMode);

  const appDefaultDisplayModes = useMemo(() => resolveAppDefaultDisplayModes(prefs), [prefs]);
  const feedDisplayOverrides = useMemo(() => resolveFeedDisplayOverrides(feed), [feed]);
  const temporaryOverride = useMemo(
    () => ({
      readerMode: null,
      webPreviewMode: webPreviewSessionModeToOverride(webPreviewSessionMode),
    }),
    [webPreviewSessionMode],
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

  const setBrowserOverlayOpenPreference = useCallback(() => {
    setWebPreviewSessionMode("forced-on");
  }, [setWebPreviewSessionMode]);

  const setBrowserOverlayClosedPreference = useCallback(() => {
    setWebPreviewSessionMode("forced-off");
  }, [setWebPreviewSessionMode]);

  return {
    requestedDisplay,
    resolvedDisplay,
    shouldShowBrowserOverlay,
    setBrowserOverlayOpenPreference,
    setBrowserOverlayClosedPreference,
  };
}
