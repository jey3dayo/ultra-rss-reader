import type { SubscriptionSummaryCard } from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsListLoadState } from "../subscriptions-load-status";

export type QueryLoadState = {
  pending: boolean;
  error: boolean;
  hasData: boolean;
  fetching: boolean;
  retry: () => void;
};

type SummaryDataState = "ready" | "loading" | "unavailable";

export function isQueryUnavailable(query: QueryLoadState): boolean {
  return query.error && !query.hasData;
}

function resolveSummaryDataState(accountSelected: boolean, queries: readonly QueryLoadState[]): SummaryDataState {
  if (queries.some(isQueryUnavailable)) return "unavailable";
  return accountSelected && queries.some((query) => query.pending) ? "loading" : "ready";
}

// A query that has not produced data must not read as zero; only the total card is feed-only.
export function applySummaryCardDataState(params: {
  cards: SubscriptionSummaryCard[];
  accountSelected: boolean;
  feeds: QueryLoadState;
  summaries: QueryLoadState;
  labels: { loading: string; unavailable: string };
}): SubscriptionSummaryCard[] {
  const { cards, accountSelected, feeds, summaries, labels } = params;
  const totalState = resolveSummaryDataState(accountSelected, [feeds]);
  const derivedState = resolveSummaryDataState(accountSelected, [feeds, summaries]);

  return cards.map((card) => {
    const state = card.filterKey === "all" ? totalState : derivedState;
    if (state === "ready") return card;
    return { ...card, value: labels[state], caption: "", tone: "neutral", isActionable: false };
  });
}

export function resolveListLoadState(params: {
  accountSelected: boolean;
  rowsPending: boolean;
  feeds: QueryLoadState;
  labels: { loading: string; failure: string; retry: string };
}): SubscriptionsListLoadState {
  const { accountSelected, rowsPending, feeds, labels } = params;
  if (feeds.error) {
    return {
      status: "error",
      failure: { message: labels.failure, retryLabel: labels.retry, retrying: feeds.fetching, onRetry: feeds.retry },
      hasData: feeds.hasData,
    };
  }
  return accountSelected && rowsPending ? { status: "loading", label: labels.loading } : { status: "ready" };
}

export function resolveListPaneDisplay(loadState: SubscriptionsListLoadState, hasRows: boolean) {
  const loading = loadState.status === "loading";
  const listUnavailable = loadState.status === "error" && !loadState.hasData;
  const showEmptyState = !hasRows && !loading && !listUnavailable;
  return {
    loading,
    listUnavailable,
    showRows: hasRows && !loading,
    showEmptyState,
    showKeptBanner: !loading && !listUnavailable,
  };
}
