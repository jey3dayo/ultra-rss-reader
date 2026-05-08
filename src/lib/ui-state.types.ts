import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";

export type UiSelection = ReaderSelection;

export type LayoutMode = "wide" | "compact" | "mobile";
export type FocusedPane = "sidebar" | "list" | "content";
export type ContentMode = "empty" | "reader" | "browser" | "loading";
export type PendingBrowserCloseAction = "prev-article" | "next-article" | "prev-feed" | "next-feed";
export type ArticleNavigationDirection = 1 | -1;

export type BrowserNavigationState = {
  canGoBack: boolean;
  canGoForward: boolean;
};

export type SubscriptionSummaryFilterState = SubscriptionSummaryFilterKey;

export type SubscriptionsWorkspaceReturnState = {
  activeSummaryFilter: SubscriptionSummaryFilterState;
  selectedFeedId: string | null;
  expandedGroups: Record<string, boolean>;
  listScrollTop: number;
  keptFeedIds: string[];
  deferredFeedIds: string[];
};

export type SubscriptionsWorkspace = {
  kind: "index";
  returnState?: SubscriptionsWorkspaceReturnState;
};
