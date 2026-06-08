export const denseNarrowViewportId = "mobile2";
export const denseNarrowViewportStoryIds = [
  "reader-sidebar-feedtreeview--dense-narrow-a-11-y-state",
  "reader-sidebar-sidebarheaderview--dense-narrow-viewport",
  "reader-article-list-articlelistscreenview--dense-narrow-viewport",
  "reader-article-articletoolbarview--mobile-japanese-long-labels",
  "reader-article-articletoolbarview--mobile-a-11-y-disabled-state",
  "settings-shell-settingsmodalview--dense-narrow-viewport",
  "settings-account-accountdetailview--japanese-long-labels-dense",
  "settings-account-accountdetailview--dense-a-11-y-disabled-state",
] as const;
export const storybookViewportMaxDimensionPx = 10_000;

export const denseNarrowViewportParameters = {
  viewport: {
    defaultViewport: denseNarrowViewportId,
  },
} as const;
