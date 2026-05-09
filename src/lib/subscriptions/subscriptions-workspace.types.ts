import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";

export type SubscriptionSummaryFilterState = SubscriptionSummaryFilterKey;

export type SubscriptionsWorkspaceReturnState = {
  accountId: string | null;
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
