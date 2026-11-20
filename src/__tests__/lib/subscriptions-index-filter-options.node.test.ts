import { describe, expect, it } from "vitest";
import { buildSubscriptionsFilterBarModel } from "@/components/subscriptions-index/hooks/subscriptions-index-filter-options";
import type { QueryLoadState } from "@/components/subscriptions-index/hooks/subscriptions-index-load-state";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";

const ready: QueryLoadState = { pending: false, error: false, hasData: true, fetching: false, retry: () => {} };
const labels = { group: "g", all: "all", stale: "stale", frequent: "freq", frequentCriteria: "c", fetchErrors: "err" };

function buildModel(overrides: {
  activeSummaryFilter?: SubscriptionSummaryFilterKey;
  summaries?: QueryLoadState;
  fetchStatuses?: { isLocalAccount: boolean; hasData: boolean; pending: boolean; error: boolean };
}) {
  return buildSubscriptionsFilterBarModel({
    rows: [],
    keptFeedIds: new Set(),
    activeSummaryFilter: overrides.activeSummaryFilter ?? "all",
    accountSelected: true,
    feeds: ready,
    summaries: overrides.summaries ?? ready,
    fetchStatuses: overrides.fetchStatuses ?? { isLocalAccount: true, hasData: true, pending: false, error: false },
    labels,
  });
}

describe("buildSubscriptionsFilterBarModel", () => {
  it("hides the fetch errors filter at zero unless it is selected, and omits counts that are not ready", () => {
    expect(buildModel({}).options.map((option) => option.filterKey)).toEqual(["all", "stale", "frequent"]);
    expect(buildModel({ activeSummaryFilter: "fetch_errors" }).options.map((option) => option.filterKey)).toEqual([
      "all",
      "stale",
      "frequent",
      "fetch_errors",
    ]);

    const unreadySummaries = buildModel({ summaries: { ...ready, pending: true } }).options;
    expect(unreadySummaries.map((option) => option.count)).toEqual([0, null, null]);

    const unreadyStatuses = buildModel({
      activeSummaryFilter: "fetch_errors",
      fetchStatuses: { isLocalAccount: true, hasData: true, pending: false, error: true },
    }).options;
    expect(unreadyStatuses.at(-1)?.count).toBeNull();
  });
});
