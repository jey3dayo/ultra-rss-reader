import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import {
  resolveExistingKeptFeedIds,
  resolveHiddenKeptFeedIds,
  resolveSubscriptionKeptBannerMode,
} from "@/lib/subscriptions/subscription-kept-visibility";
import { buildSubscriptionListRows, buildVisibleSubscriptionRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow, SubscriptionRowStatus } from "@/lib/subscriptions/subscriptions-index.types";

function makeRow(
  feedId: string,
  labelKey: SubscriptionRowStatus["labelKey"] = "stale_90d",
  fetchFailed = false,
): SubscriptionListRow {
  const feed: FeedDto = {
    id: feedId,
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: feedId,
    url: `https://example.com/${feedId}.xml`,
    site_url: `https://example.com/${feedId}`,
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
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
  return {
    ...row,
    status: { labelKey },
    ...(fetchFailed
      ? {
          fetchError: {
            feed_id: feedId,
            last_attempt_at: "2026-04-04T12:00:00Z",
            last_success_at: null,
            error_kind: "network",
            error_count: 1,
            diagnostic_id: null,
          },
        }
      : {}),
  };
}

const rows = [
  makeRow("stale-kept"),
  makeRow("stale-kept-failing", "stale_90d", true),
  makeRow("stale-open"),
  makeRow("fresh-kept", "normal"),
];
const keptFeedIds = new Set(["stale-kept", "stale-kept-failing", "fresh-kept"]);

describe("resolveHiddenKeptFeedIds", () => {
  it("counts only kept feeds the stale filter actually hides", () => {
    const hidden = resolveHiddenKeptFeedIds({ rows, activeSummaryFilter: "stale", keptFeedIds, searchQuery: "" });

    expect([...hidden]).toEqual(["stale-kept"]);
  });

  it("hides nothing outside the stale filter", () => {
    const hidden = resolveHiddenKeptFeedIds({ rows, activeSummaryFilter: "all", keptFeedIds, searchQuery: "" });

    expect(hidden.size).toBe(0);
  });

  it("follows the search query", () => {
    const hidden = resolveHiddenKeptFeedIds({
      rows,
      activeSummaryFilter: "stale",
      keptFeedIds,
      searchQuery: "stale-open",
    });

    expect(hidden.size).toBe(0);
  });

  it("matches the rows that showing kept feeds adds to the same list", () => {
    const query = { rows, activeSummaryFilter: "stale", keptFeedIds, searchQuery: "stale" } as const;
    const listed = (showKept: boolean) =>
      buildVisibleSubscriptionRows({ ...query, showKept, sortKey: "title" }).map((row) => row.feed.id);

    const added = listed(true).filter((feedId) => !listed(false).includes(feedId));

    expect(added).toEqual(["stale-kept"]);
    expect([...resolveHiddenKeptFeedIds(query)]).toEqual(added);
  });
});

describe("resolveExistingKeptFeedIds", () => {
  it("ignores kept ids that no longer have a row", () => {
    const existing = resolveExistingKeptFeedIds(rows, new Set([...keptFeedIds, "feed-gone"]));

    expect([...existing].sort()).toEqual(["fresh-kept", "stale-kept", "stale-kept-failing"]);
  });
});

describe("resolveSubscriptionKeptBannerMode", () => {
  it.each([
    ["stale", false, 2, "hidden"],
    ["stale", true, 2, "shown"],
    ["stale", false, 0, "summary"],
    ["stale", true, 0, "summary"],
    ["all", false, 0, "summary"],
    ["frequent", true, 0, "summary"],
  ] as const)("%s filter, showKept=%s, hidden=%s -> %s", (activeSummaryFilter, showKept, hiddenKeptCount, expected) => {
    expect(resolveSubscriptionKeptBannerMode({ activeSummaryFilter, showKept, hiddenKeptCount })).toBe(expected);
  });
});
