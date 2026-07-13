import { z } from "zod";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";

export type SubscriptionsWorkspaceExpandedGroupKey = `group:${string}`;

// Every SubscriptionSummaryFilterKey (source of truth) must be persistable here,
// otherwise restoring a returnState whose activeSummaryFilter uses the missing
// key throws at parse time. The type guard below fails to compile if a new
// filter key is added to the union but not to this enum.
const subscriptionSummaryFilterStateSchema = z.enum(["all", "review", "stale", "frequent"]);
type PersistedSummaryFilterDriftGuard = Exclude<
  SubscriptionSummaryFilterKey,
  z.infer<typeof subscriptionSummaryFilterStateSchema>
>;
// If this line errors, add the missing key(s) to the enum above.
const _assertAllSummaryFiltersPersisted: PersistedSummaryFilterDriftGuard extends never ? true : never = true;
void _assertAllSummaryFiltersPersisted;

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
