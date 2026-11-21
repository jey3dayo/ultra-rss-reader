import { countSubscriptionFilterRows } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionFilterOption,
  SubscriptionListRow,
  SubscriptionSummaryFilterKey,
} from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsFilterBarModel } from "../subscriptions-filter-bar";
import { areQueriesReady, type QueryLoadState } from "./subscriptions-index-load-state";

export type SubscriptionsFetchStatuses = {
  applicable: boolean;
  hasData: boolean;
  pending: boolean;
  error: boolean;
};

type FetchStatusSource = { hasData: boolean; pending: boolean; error: boolean };

/**
 * Local accounts report fetch errors from the local sync statuses and
 * FreshRSS accounts from the remote (Fever) ones; the filter bar only needs
 * the combined readiness of whichever source applies.
 */
export function resolveSubscriptionsFetchStatuses(params: {
  isLocalAccount: boolean;
  local: FetchStatusSource;
  isFreshRssAccount: boolean;
  remote: FetchStatusSource;
}): SubscriptionsFetchStatuses {
  const { isLocalAccount, local, isFreshRssAccount, remote } = params;
  return {
    applicable: isLocalAccount || isFreshRssAccount,
    hasData: (isLocalAccount && local.hasData) || (isFreshRssAccount && remote.hasData),
    pending: (isLocalAccount && local.pending) || (isFreshRssAccount && remote.pending),
    error: (isLocalAccount && local.error) || (isFreshRssAccount && remote.error),
  };
}

export function buildSubscriptionsFilterBarModel(params: {
  rows: SubscriptionListRow[];
  keptFeedIds: ReadonlySet<string>;
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  accountSelected: boolean;
  feeds: QueryLoadState;
  summaries: QueryLoadState;
  fetchStatuses: SubscriptionsFetchStatuses;
  labels: {
    group: string;
    all: string;
    stale: string;
    frequent: string;
    frequentCriteria: string;
    fetchErrors: string;
  };
}): SubscriptionsFilterBarModel {
  const { rows, keptFeedIds, activeSummaryFilter, accountSelected, feeds, summaries, fetchStatuses, labels } = params;
  const counts = countSubscriptionFilterRows(rows, keptFeedIds);
  const feedsReady = areQueriesReady(accountSelected, [feeds]);
  const derivedReady = areQueriesReady(accountSelected, [feeds, summaries]);
  const fetchErrorsReady =
    fetchStatuses.applicable &&
    fetchStatuses.hasData &&
    !fetchStatuses.pending &&
    !fetchStatuses.error &&
    !feeds.pending &&
    !feeds.error;
  const fetchErrorCount = fetchErrorsReady ? counts.fetch_errors : null;

  const candidates: Omit<SubscriptionFilterOption, "isActive">[] = [
    { filterKey: "all", label: labels.all, count: feedsReady ? counts.all : null },
    { filterKey: "stale", label: labels.stale, count: derivedReady ? counts.stale : null },
    {
      filterKey: "frequent",
      label: labels.frequent,
      count: derivedReady ? counts.frequent : null,
      tooltip: labels.frequentCriteria,
    },
    { filterKey: "fetch_errors", label: labels.fetchErrors, count: fetchErrorCount },
  ];
  const options = candidates
    .filter(
      (option) =>
        option.filterKey !== "fetch_errors" || (option.count ?? 0) > 0 || activeSummaryFilter === "fetch_errors",
    )
    .map((option) => ({ ...option, isActive: option.filterKey === activeSummaryFilter }));

  return {
    ariaLabel: labels.group,
    options,
    activeDescription: options.find((option) => option.isActive)?.tooltip ?? null,
  };
}
