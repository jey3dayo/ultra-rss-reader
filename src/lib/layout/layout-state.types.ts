export type LayoutMode = "wide" | "compact" | "mobile";
export type FocusedPane = "sidebar" | "list" | "content";
export type ContentMode = "empty" | "reader" | "browser" | "loading";
export type PendingBrowserCloseAction = "prev-article" | "next-article" | "prev-feed" | "next-feed";
export type ArticleNavigationDirection = 1 | -1;

export type BrowserNavigationState = {
  canGoBack: boolean;
  canGoForward: boolean;
};
