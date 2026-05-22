import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";
import type { SubscriptionsWorkspaceReturnState } from "@/schemas/subscriptions-workspace";

export {
  type SubscriptionsWorkspaceExpandedGroupKey,
  type SubscriptionsWorkspaceListScrollState,
  SubscriptionsWorkspaceListScrollStateSchema,
  type SubscriptionsWorkspaceReturnState,
  SubscriptionsWorkspaceReturnStateSchema,
} from "@/schemas/subscriptions-workspace";

export type SubscriptionSummaryFilterState = SubscriptionSummaryFilterKey;

export type SubscriptionsWorkspace = {
  kind: "index";
  returnState?: SubscriptionsWorkspaceReturnState;
};
