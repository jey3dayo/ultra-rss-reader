import * as v from "valibot";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";
import * as s from "@/schemas/validation";

export type SubscriptionsWorkspaceExpandedGroupKey = `group:${string}`;

// Every SubscriptionSummaryFilterKey (source of truth) must be persistable here,
// otherwise restoring a returnState whose activeSummaryFilter uses the missing
// key throws at parse time. The type guard below fails to compile if a new
// filter key is added to the union but not to this enum.
const subscriptionSummaryFilterStateSchema = v.picklist(["all", "review", "stale", "frequent"]);
type PersistedSummaryFilterDriftGuard = Exclude<
  SubscriptionSummaryFilterKey,
  v.InferOutput<typeof subscriptionSummaryFilterStateSchema>
>;
// If this line errors, add the missing key(s) to the enum above.
const _assertAllSummaryFiltersPersisted: PersistedSummaryFilterDriftGuard extends never ? true : never = true;
void _assertAllSummaryFiltersPersisted;

const subscriptionsWorkspaceAccountIdSchema = v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1)));

const subscriptionsWorkspaceIdentitySchema = v.pipe(v.string(), v.trim(), v.minLength(1));

const subscriptionsWorkspaceExpandedGroupKeySchema = v.custom<SubscriptionsWorkspaceExpandedGroupKey>(
  (value) => typeof value === "string" && value.startsWith("group:") && value.length > "group:".length,
);

export const SubscriptionsWorkspaceListScrollStateSchema = s.strictObject({
  scrollTop: v.pipe(v.number(), v.finite(), v.minValue(0)),
  layoutGeneration: v.string(),
  viewportHeight: v.pipe(v.number(), v.finite(), v.minValue(0)),
});

export type SubscriptionsWorkspaceListScrollState = v.InferOutput<typeof SubscriptionsWorkspaceListScrollStateSchema>;

export const SubscriptionsWorkspaceReturnStateSchema = s.strictObject({
  accountId: subscriptionsWorkspaceAccountIdSchema,
  activeSummaryFilter: subscriptionSummaryFilterStateSchema,
  selectedFeedId: v.nullable(subscriptionsWorkspaceIdentitySchema),
  expandedGroups: v.pipe(
    s.record(v.string(), v.boolean()),
    v.check((groups) =>
      Object.keys(groups).every((key) => v.safeParse(subscriptionsWorkspaceExpandedGroupKeySchema, key).success),
    ),
  ),
  listScrollTop: SubscriptionsWorkspaceListScrollStateSchema,
  keptFeedIds: v.array(subscriptionsWorkspaceIdentitySchema),
  deferredFeedIds: v.array(subscriptionsWorkspaceIdentitySchema),
});

export type SubscriptionsWorkspaceReturnState = v.InferOutput<typeof SubscriptionsWorkspaceReturnStateSchema>;
