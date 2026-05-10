import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";

export type SubscriptionSummaryFilterState = SubscriptionSummaryFilterKey;

export type SubscriptionsWorkspaceExpandedGroupKey = `group:${string}`;

export type SubscriptionsWorkspaceListScrollState = {
  scrollTop: number;
  layoutGeneration: string;
  viewportHeight: number;
};

export type SubscriptionsWorkspaceReturnState = {
  accountId: string | null;
  activeSummaryFilter: SubscriptionSummaryFilterState;
  selectedFeedId: string | null;
  expandedGroups: Record<SubscriptionsWorkspaceExpandedGroupKey, boolean>;
  listScrollTop: SubscriptionsWorkspaceListScrollState;
  keptFeedIds: string[];
  deferredFeedIds: string[];
};

export type SubscriptionsWorkspace = {
  kind: "index";
  returnState?: SubscriptionsWorkspaceReturnState;
};
