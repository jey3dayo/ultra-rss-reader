import type { FeedDto, RemoteFeedSyncStatusDto } from "@/api/tauri-commands";
import { getDateInputTimeMs } from "@/lib/datetime";

export type RemoteFeedFetchFailure = {
  lastSuccessAt: string;
};

/**
 * How far a bridge feed's last successful refresh may lag behind the
 * account's freshest one before it counts as a fetch failure. FreshRSS
 * refreshes default-TTL feeds about hourly, so 48 hours of lag means many
 * consecutive missed refreshes, while a FreshRSS-wide outage stops every
 * feed together and produces no lag (and therefore no failure flags).
 */
export const REMOTE_FEED_FETCH_FAILURE_LAG_MS = 48 * 60 * 60 * 1000;

const BRIDGE_SERVICE_NAME = "manga-feeds";
const CLUSTER_SERVICE_SUFFIX = ".svc.cluster.local";

/**
 * Whether the feed is served by the manga-rss-bridge service. Only bridge
 * feeds are judged by their FreshRSS-side last-success time: for official
 * feeds subscribed directly through FreshRSS, a stopped last-success time
 * is not treated as a failure (see issue #766's decision).
 */
export function isBridgeFeedUrl(rawUrl: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hostname === BRIDGE_SERVICE_NAME) {
    return true;
  }
  return hostname.startsWith(`${BRIDGE_SERVICE_NAME}.`) && hostname.endsWith(CLUSTER_SERVICE_SUFFIX);
}

export function resolveRemoteFeedFetchFailures(params: {
  feeds: FeedDto[];
  statuses: RemoteFeedSyncStatusDto[] | undefined;
}): Map<string, RemoteFeedFetchFailure> {
  const failures = new Map<string, RemoteFeedFetchFailure>();
  const { feeds, statuses } = params;
  if (!statuses) {
    return failures;
  }

  const statusByFeedId = new Map(statuses.map((status) => [status.feed_id, status]));
  let newestSuccessMs: number | null = null;
  for (const status of statuses) {
    const successMs = getDateInputTimeMs(status.last_success_at);
    if (successMs !== null && (newestSuccessMs === null || successMs > newestSuccessMs)) {
      newestSuccessMs = successMs;
    }
  }
  if (newestSuccessMs === null) {
    return failures;
  }

  for (const feed of feeds) {
    if (!isBridgeFeedUrl(feed.url)) {
      continue;
    }
    const status = statusByFeedId.get(feed.id);
    if (!status?.last_success_at) {
      continue;
    }
    const successMs = getDateInputTimeMs(status.last_success_at);
    if (successMs === null) {
      continue;
    }
    if (newestSuccessMs - successMs >= REMOTE_FEED_FETCH_FAILURE_LAG_MS) {
      failures.set(feed.id, { lastSuccessAt: status.last_success_at });
    }
  }

  return failures;
}
