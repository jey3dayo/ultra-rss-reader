export const denseNarrowViewportId = "mobile2";
export const denseNarrowViewportStoryIds = [
  "reader-sidebar-feedtreeview--dense-narrow-a-11-y-state",
  "reader-sidebar-sidebarheaderview--dense-narrow-viewport",
  "reader-article-articlelistscreenview--dense-narrow-viewport",
  "reader-article-articletoolbarview--mobile-japanese-long-labels",
  "reader-article-articletoolbarview--mobile-a-11-y-disabled-state",
  "settings-page-settingsmodalview--dense-narrow-viewport",
  "settings-page-accountdetailview--japanese-long-labels-dense",
  "settings-page-accountdetailview--dense-a-11-y-disabled-state",
] as const;
export const storybookViewportMaxDimensionPx = 10_000;

export const denseNarrowViewportParameters = {
  viewport: {
    defaultViewport: denseNarrowViewportId,
  },
} as const;
