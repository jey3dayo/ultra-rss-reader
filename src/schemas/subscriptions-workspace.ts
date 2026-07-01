import { z } from "zod";

export type SubscriptionsWorkspaceExpandedGroupKey = `group:${string}`;

const subscriptionSummaryFilterStateSchema = z.enum(["all", "review", "stale"]);

const subscriptionsWorkspaceAccountIdSchema = z.string().trim().min(1).nullable();

const subscriptionsWorkspaceIdentitySchema = z.string().trim().min(1);

const subscriptionsWorkspaceExpandedGroupKeySchema = z.custom<SubscriptionsWorkspaceExpandedGroupKey>(
  (value) => typeof value === "string" && value.startsWith("group:") && value.length > "group:".length,
);

export const SubscriptionsWorkspaceListScrollStateSchema = z.strictObject({
  scrollTop: z.number().finite().nonnegative(),
  layoutGeneration: z.string(),
  viewportHeight: z.number().finite().nonnegative(),
});

export type SubscriptionsWorkspaceListScrollState = z.output<typeof SubscriptionsWorkspaceListScrollStateSchema>;

export const SubscriptionsWorkspaceReturnStateSchema = z.strictObject({
  accountId: subscriptionsWorkspaceAccountIdSchema,
  activeSummaryFilter: subscriptionSummaryFilterStateSchema,
  selectedFeedId: subscriptionsWorkspaceIdentitySchema.nullable(),
  expandedGroups: z.record(subscriptionsWorkspaceExpandedGroupKeySchema, z.boolean()),
  listScrollTop: SubscriptionsWorkspaceListScrollStateSchema,
  keptFeedIds: z.array(subscriptionsWorkspaceIdentitySchema),
  deferredFeedIds: z.array(subscriptionsWorkspaceIdentitySchema),
});

export type SubscriptionsWorkspaceReturnState = z.output<typeof SubscriptionsWorkspaceReturnStateSchema>;
