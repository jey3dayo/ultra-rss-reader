export type ArticleDisplayPreset = "reader_only" | "reader_and_preview" | "preview_only";
export type BinaryDisplayMode = "on" | "off";
export type TriStateDisplayMode = "inherit" | BinaryDisplayMode;
export type ArticleDisplayFallbackReason = "missing_web_preview" | "invalid_empty_display" | null;
export type FeedDisplayPresetOption = "default" | ArticleDisplayPreset;

export type ArticleDisplayModes = {
  readerMode: boolean;
  webPreviewMode: boolean;
};

export type ArticleDisplayResolveParams = {
  appDefault: ArticleDisplayModes;
  feedOverride: {
    readerMode: TriStateDisplayMode;
    webPreviewMode: TriStateDisplayMode;
  };
  temporaryOverride: {
    readerMode: BinaryDisplayMode | null;
    webPreviewMode: BinaryDisplayMode | null;
  };
  articleCapabilities: {
    hasWebPreview: boolean;
  };
};

export type ResolvedArticleDisplay = ArticleDisplayModes & {
  preset: ArticleDisplayPreset;
  fallbackReason: ArticleDisplayFallbackReason;
};

type FeedLikeDisplaySettings = {
  reader_mode?: string | null;
  web_preview_mode?: string | null;
};

export function displayPresetToModes(preset: ArticleDisplayPreset): ArticleDisplayModes {
  switch (preset) {
    case "reader_only":
      return { readerMode: true, webPreviewMode: false };
    case "reader_and_preview":
      return { readerMode: true, webPreviewMode: true };
    case "preview_only":
      return { readerMode: false, webPreviewMode: true };
  }
}

export function modesToDisplayPreset(modes: ArticleDisplayModes): ArticleDisplayPreset {
  if (modes.readerMode && modes.webPreviewMode) {
    return "reader_and_preview";
  }

  if (modes.readerMode) {
    return "reader_only";
  }

  return "preview_only";
}

export function displayPresetToPreferenceValues(preset: ArticleDisplayPreset): {
  reader_mode_default: "true" | "false";
  web_preview_mode_default: "true" | "false";
} {
  const modes = displayPresetToModes(preset);
  return {
    reader_mode_default: String(modes.readerMode) as "true" | "false",
    web_preview_mode_default: String(modes.webPreviewMode) as "true" | "false",
  };
}

export function appDefaultsToDisplayPreset(
  readerModeDefault: string | undefined,
  webPreviewModeDefault: string | undefined,
): ArticleDisplayPreset {
  return modesToDisplayPreset({
    readerMode: readerModeDefault !== "false",
    webPreviewMode: webPreviewModeDefault === "true",
  });
}

export function resolveAppDefaultDisplayModes(prefs: Record<string, string>): ArticleDisplayModes {
  const readerModeDefault = prefs.reader_mode_default;
  const webPreviewModeDefault = prefs.web_preview_mode_default;

  return {
    readerMode: readerModeDefault !== "false",
    webPreviewMode: webPreviewModeDefault === "true",
  };
}

export function resolveAppDefaultDisplayPreset(prefs: Record<string, string>): ArticleDisplayPreset {
  return modesToDisplayPreset(resolveAppDefaultDisplayModes(prefs));
}

export function resolveFeedDisplayOverrides(feed: FeedLikeDisplaySettings | null | undefined): {
  readerMode: TriStateDisplayMode;
  webPreviewMode: TriStateDisplayMode;
} {
  if (!feed) {
    return { readerMode: "inherit", webPreviewMode: "inherit" };
  }

  const readerMode = feed.reader_mode;
  const webPreviewMode = feed.web_preview_mode;
  if (
    (readerMode === "inherit" || readerMode === "on" || readerMode === "off") &&
    (webPreviewMode === "inherit" || webPreviewMode === "on" || webPreviewMode === "off")
  ) {
    return {
      readerMode,
      webPreviewMode,
    };
  }

  return { readerMode: "inherit", webPreviewMode: "inherit" };
}

export function displayPresetToTriStateModes(preset: FeedDisplayPresetOption): {
  readerMode: TriStateDisplayMode;
  webPreviewMode: TriStateDisplayMode;
} {
  if (preset === "default") {
    return {
      readerMode: "inherit",
      webPreviewMode: "inherit",
    };
  }

  const modes = displayPresetToModes(preset);
  return {
    readerMode: modes.readerMode ? "on" : "off",
    webPreviewMode: modes.webPreviewMode ? "on" : "off",
  };
}

export function feedModesToDisplayPresetOption(
  readerMode: TriStateDisplayMode,
  webPreviewMode: TriStateDisplayMode,
): FeedDisplayPresetOption {
  if (readerMode === "inherit" && webPreviewMode === "inherit") {
    return "default";
  }

  return modesToDisplayPreset({
    readerMode: readerMode === "on",
    webPreviewMode: webPreviewMode === "on",
  });
}

function resolveTriState(baseValue: boolean, override: TriStateDisplayMode): boolean {
  if (override === "inherit") {
    return baseValue;
  }

  return override === "on";
}

function resolveTemporaryOverride(baseValue: boolean, override: BinaryDisplayMode | null): boolean {
  if (override == null) {
    return baseValue;
  }

  return override === "on";
}

export function resolveArticleDisplay(params: ArticleDisplayResolveParams): ResolvedArticleDisplay {
  const readerAfterFeed = resolveTriState(params.appDefault.readerMode, params.feedOverride.readerMode);
  const previewAfterFeed = resolveTriState(params.appDefault.webPreviewMode, params.feedOverride.webPreviewMode);

  let readerMode = resolveTemporaryOverride(readerAfterFeed, params.temporaryOverride.readerMode);
  let webPreviewMode = resolveTemporaryOverride(previewAfterFeed, params.temporaryOverride.webPreviewMode);
  let fallbackReason: ArticleDisplayFallbackReason = null;

  if (!readerMode && !webPreviewMode) {
    readerMode = true;
    fallbackReason = "invalid_empty_display";
  }

  if (webPreviewMode && !params.articleCapabilities.hasWebPreview) {
    readerMode = true;
    webPreviewMode = false;
    fallbackReason = "missing_web_preview";
  }

  return {
    readerMode,
    webPreviewMode,
    preset: modesToDisplayPreset({ readerMode, webPreviewMode }),
    fallbackReason,
  };
}
