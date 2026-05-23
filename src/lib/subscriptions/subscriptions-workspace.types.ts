import type { SubscriptionsWorkspaceReturnState } from "@/schemas/subscriptions-workspace";

export {
  type SubscriptionsWorkspaceExpandedGroupKey,
  type SubscriptionsWorkspaceListScrollState,
  SubscriptionsWorkspaceListScrollStateSchema,
  type SubscriptionsWorkspaceReturnState,
  SubscriptionsWorkspaceReturnStateSchema,
} from "@/schemas/subscriptions-workspace";

export type SubscriptionsWorkspace = {
  kind: "index";
  returnState?: SubscriptionsWorkspaceReturnState;
};
