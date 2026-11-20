import type { SubscriptionsListLoadState } from "../subscriptions-load-status";

export type QueryLoadState = {
  pending: boolean;
  error: boolean;
  hasData: boolean;
  fetching: boolean;
  retry: () => void;
};

export function isQueryUnavailable(query: QueryLoadState): boolean {
  return query.error && !query.hasData;
}

export function areQueriesReady(accountSelected: boolean, queries: readonly QueryLoadState[]): boolean {
  return !queries.some(isQueryUnavailable) && !(accountSelected && queries.some((query) => query.pending));
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
