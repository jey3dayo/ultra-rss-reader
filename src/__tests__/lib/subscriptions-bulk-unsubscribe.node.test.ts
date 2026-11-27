import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { resolveBulkSelectableFeedIds, resolveBulkUnsubscribeTargets } from "@/lib/subscriptions/bulk-unsubscribe";
import { buildSubscriptionListRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

function makeRow(feedId: string, title: string = feedId): SubscriptionListRow {
  const feed: FeedDto = {
    id: feedId,
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title,
    url: `https://example.com/${feedId}.xml`,
    site_url: `https://example.com/${feedId}`,
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    created_at: null,
  };

  const [row] = buildSubscriptionListRows({
    feeds: [feed],
    candidateMap: new Map(),
    feedArticleSummaryMap: new Map(),
    folderNameById: new Map(),
  });

  if (!row) {
    throw new Error(`Failed to build subscription row for ${feedId}`);
  }

  return row;
}

describe("resolveBulkUnsubscribeTargets", () => {
  it("flags kept feeds that were selected by hand instead of dropping them", () => {
    const rows = [makeRow("feed-a"), makeRow("feed-b")];

    const targets = resolveBulkUnsubscribeTargets({
      rows,
      selectedFeedIds: new Set(["feed-a", "feed-b"]),
      keptFeedIds: new Set(["feed-b"]),
    });

    expect(targets.map(({ row, wasKept }) => [row.feed.id, wasKept])).toEqual([
      ["feed-a", false],
      ["feed-b", true],
    ]);
  });

  it("targets only selected feeds that still exist in rows", () => {
    const rows = [makeRow("feed-a"), makeRow("feed-b")];

    const targets = resolveBulkUnsubscribeTargets({
      rows,
      selectedFeedIds: new Set(["feed-b", "feed-gone"]),
      keptFeedIds: new Set(),
    });

    expect(targets.map(({ row }) => row.feed.id)).toEqual(["feed-b"]);
  });

  it("orders targets by title and then by feed id, regardless of selection or row order", () => {
    const rows = [makeRow("feed-3", "Zeta"), makeRow("feed-2", "Alpha"), makeRow("feed-1", "Alpha")];

    const targets = resolveBulkUnsubscribeTargets({
      rows,
      selectedFeedIds: new Set(["feed-3", "feed-2", "feed-1"]),
      keptFeedIds: new Set(),
    });

    expect(targets.map(({ row }) => row.feed.id)).toEqual(["feed-1", "feed-2", "feed-3"]);
  });
});

describe("resolveBulkSelectableFeedIds", () => {
  it("excludes kept rows even when they are still visible and reports how many were skipped", () => {
    const visibleRows = [makeRow("feed-a"), makeRow("feed-kept"), makeRow("feed-b")];

    expect(resolveBulkSelectableFeedIds({ visibleRows, keptFeedIds: new Set(["feed-kept"]) })).toEqual({
      feedIds: ["feed-a", "feed-b"],
      skippedKeptCount: 1,
    });
  });

  it("selects everything and skips nothing when no visible row is kept", () => {
    const visibleRows = [makeRow("feed-a"), makeRow("feed-b")];

    expect(resolveBulkSelectableFeedIds({ visibleRows, keptFeedIds: new Set(["feed-hidden"]) })).toEqual({
      feedIds: ["feed-a", "feed-b"],
      skippedKeptCount: 0,
    });
  });
});
