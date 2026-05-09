export const APP_EVENTS = {
  navigateArticle: "ultra-rss:navigate-article",
  navigateFeed: "ultra-rss:navigate-feed",
  debugInputTrace: "ultra-rss:debug-input-trace",
  browserDebugGeometry: "ultra-rss:browser-debug-geometry",
  menuAction: "menu-action",
} as const;
export type AppEventName = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];

export const APP_RUNTIME_EVENT_CONTRACT = {
  publicWindowEvents: [
    APP_EVENTS.navigateArticle,
    APP_EVENTS.navigateFeed,
    APP_EVENTS.debugInputTrace,
    APP_EVENTS.browserDebugGeometry,
  ],
  publicTauriEvents: [APP_EVENTS.menuAction],
} as const satisfies {
  publicWindowEvents: readonly AppEventName[];
  publicTauriEvents: readonly AppEventName[];
};
