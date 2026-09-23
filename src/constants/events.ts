export const APP_EVENTS = {
  navigateArticle: "ultra-rss:navigate-article",
  navigateFeed: "ultra-rss:navigate-feed",
  debugInputTrace: "ultra-rss:debug-input-trace",
  browserDebugGeometry: "ultra-rss:browser-debug-geometry",
  menuAction: "menu-action",
} as const;
export type AppEventName = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];
