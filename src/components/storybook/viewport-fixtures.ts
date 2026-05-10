export const denseNarrowViewportId = "mobile2";
export const denseNarrowViewportStoryIds = [
  "reader-sidebar-sidebarheaderview--dense-narrow-viewport",
  "reader-article-articlelistscreenview--dense-narrow-viewport",
  "settings-page-settingsmodalview--dense-narrow-viewport",
] as const;
export const storybookViewportMaxDimensionPx = 10_000;

export const denseNarrowViewportParameters = {
  viewport: {
    defaultViewport: denseNarrowViewportId,
  },
} as const;
