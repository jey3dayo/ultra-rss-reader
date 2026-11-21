import type { FeedDto, LocalFeedSyncStatusDto, RemoteFeedSyncStatusDto } from "@/api/tauri-commands";
import { resolveRemoteFeedFetchFailures } from "@/lib/subscriptions/remote-feed-fetch-failure";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";

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

export function attachRemoteFeedFetchFailures(
  rows: SubscriptionListRow[],
  feeds: FeedDto[],
  statuses: RemoteFeedSyncStatusDto[] | undefined,
  isFreshRssAccount: boolean,
): SubscriptionListRow[] {
  if (!isFreshRssAccount || !statuses) return rows;
  const failures = resolveRemoteFeedFetchFailures({ feeds, statuses });
  if (failures.size === 0) return rows;
  return rows.map((row) => {
    const remoteFetchFailure = failures.get(row.feed.id);
    return remoteFetchFailure ? { ...row, reasonTooltipKey: "remote_fetch_error", remoteFetchFailure } : row;
  });
}

export function resolveSubscriptionsEmptyLabel(
  activeSummaryFilter: SubscriptionSummaryFilterKey,
  failedFeedCount: number | null,
  summariesUnavailable: boolean,
  labels: { default: string; fetchErrorsUnknown: string; fetchErrorsEmpty: string; summariesUnavailable: string },
): string {
  if (summariesUnavailable && (activeSummaryFilter === "stale" || activeSummaryFilter === "frequent")) {
    return labels.summariesUnavailable;
  }
  if (activeSummaryFilter !== "fetch_errors") return labels.default;
  if (failedFeedCount === null) return labels.fetchErrorsUnknown;
  if (failedFeedCount === 0) return labels.fetchErrorsEmpty;
  return labels.default;
}
