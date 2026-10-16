import type { FeedDto, LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import type {
  SubscriptionListRow,
  SubscriptionSummaryCard,
  SubscriptionSummaryFilterKey,
} from "@/lib/subscriptions/subscriptions-index.types";

export function attachLocalFeedFetchErrors(
  rows: SubscriptionListRow[],
  feeds: FeedDto[],
  statuses: LocalFeedSyncStatusDto[] | undefined,
  isLocalAccount: boolean,
): SubscriptionListRow[] {
  if (!isLocalAccount || !statuses) return rows;
  const feedIds = new Set(feeds.map((feed) => feed.id));
  const statusesByFeedId = new Map(
    statuses
      .filter((status) => feedIds.has(status.feed_id) && status.error_kind !== null)
      .map((status) => [status.feed_id, status]),
  );
  return rows.map((row) => {
    const fetchError = statusesByFeedId.get(row.feed.id);
    return fetchError ? { ...row, reasonTooltipKey: "fetch_error", fetchError } : row;
  });
}

export type FetchErrorSummaryLabels = {
  label: string;
  loading: string;
  unavailable: string;
  unknown: string;
  none: string;
  caption: (count: number) => string;
};

export function buildLocalFetchErrorSummary(params: {
  isLocalAccount: boolean;
  feeds: FeedDto[];
  statuses: LocalFeedSyncStatusDto[] | undefined;
  statusesPending: boolean;
  statusesError: boolean;
  feedListPending: boolean;
  feedListError: boolean;
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  labels: FetchErrorSummaryLabels;
}): { card: SubscriptionSummaryCard | null; failedFeedCount: number | null } {
  const {
    isLocalAccount,
    feeds,
    statuses,
    statusesPending,
    statusesError,
    feedListPending,
    feedListError,
    activeSummaryFilter,
    labels,
  } = params;
  if (!isLocalAccount) return { card: null, failedFeedCount: null };

  const feedIds = new Set(feeds.map((feed) => feed.id));
  const statusesResolved =
    Boolean(statuses) && !statusesPending && !statusesError && !feedListPending && !feedListError;
  const failedFeedCount = statusesResolved
    ? new Set(
        statuses
          ?.filter((status) => feedIds.has(status.feed_id) && status.error_kind !== null)
          .map((status) => status.feed_id),
      ).size
    : null;
  const value =
    failedFeedCount === null
      ? statusesPending || feedListPending
        ? labels.loading
        : labels.unavailable
      : String(failedFeedCount);
  const caption =
    failedFeedCount === null
      ? statusesPending || feedListPending
        ? ""
        : labels.unknown
      : failedFeedCount === 0
        ? labels.none
        : labels.caption(failedFeedCount);

  return {
    failedFeedCount,
    card: {
      filterKey: "fetch_errors",
      label: labels.label,
      value,
      caption,
      tone: failedFeedCount !== null && failedFeedCount > 0 ? "danger" : "neutral",
      isActive: activeSummaryFilter === "fetch_errors",
      isActionable: statusesResolved && failedFeedCount !== null && failedFeedCount > 0,
    },
  };
}

export function resolveSubscriptionsEmptyLabel(
  activeSummaryFilter: SubscriptionSummaryFilterKey,
  failedFeedCount: number | null,
  labels: { default: string; fetchErrorsUnknown: string; fetchErrorsEmpty: string },
): string {
  if (activeSummaryFilter !== "fetch_errors") return labels.default;
  if (failedFeedCount === null) return labels.fetchErrorsUnknown;
  if (failedFeedCount === 0) return labels.fetchErrorsEmpty;
  return labels.default;
}
