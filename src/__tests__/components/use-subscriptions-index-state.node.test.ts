import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import {
  buildListLayoutGeneration,
  findSelectedSubscriptionRow,
  resolveGroupExpansion,
  resolveInitialListScrollState,
  resolveSelectionAfterRowsChange,
  sanitizeExpandedGroups,
  toggleExpandedGroup,
} from "@/components/subscriptions-index/lib/subscriptions-index-state-model";
import { buildSubscriptionListRows } from "@/lib/subscriptions/subscriptions-index";

const feeds: FeedDto[] = [
  {
    id: "feed-first",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "First Feed",
    url: "https://example.com/first.xml",
    site_url: "https://example.com/first",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-second",
    account_id: "acc-1",
    folder_id: "folder-work",
    remote_id: null,
    title: "Second Feed",
    url: "https://example.com/second.xml",
    site_url: "https://example.com/second",
    icon_url: null,
    unread_count: 3,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
];

function buildRows() {
  return buildSubscriptionListRows({
    feeds,
    candidateMap: new Map(),
    feedArticleSummaryMap: new Map(),
    folderNameById: new Map([["folder-work", "Work"]]),
  });
}

describe("subscriptions index state model", () => {
  it("resolves selected rows and list layout generation from production subscription rows", () => {
    const rows = buildRows();

    expect(findSelectedSubscriptionRow(rows, "feed-second")?.feed.id).toBe("feed-second");
    expect(findSelectedSubscriptionRow(rows, "missing")).toBeNull();
    expect(buildListLayoutGeneration(rows)).toBe("feed-first\nfeed-second");
  });

  it("sanitizes and toggles group disclosure state without accepting non-namespaced keys", () => {
    const expandedGroups = sanitizeExpandedGroups({
      "group:folder-work": false,
      all: false,
    });

    expect(resolveGroupExpansion(expandedGroups, "folder-work")).toBe(false);
    expect(resolveGroupExpansion(expandedGroups, "all")).toBe(true);

    const toggled = toggleExpandedGroup(expandedGroups, "folder-work");

    expect(resolveGroupExpansion(toggled, "folder-work")).toBe(true);
  });

  it("normalizes returned list scroll state against layout and viewport changes", () => {
    expect(
      resolveInitialListScrollState({
        initialListScrollState: {
          scrollTop: 48,
          layoutGeneration: "feed-first",
          viewportHeight: 640,
        },
        listLayoutGeneration: "feed-first",
        listLayoutReady: true,
        viewportHeight: 640,
      }),
    ).toEqual({
      scrollTop: 48,
      layoutGeneration: "feed-first",
      viewportHeight: 640,
    });

    expect(
      resolveInitialListScrollState({
        initialListScrollState: {
          scrollTop: 48,
          layoutGeneration: "stale-layout",
          viewportHeight: 640,
        },
        listLayoutGeneration: "feed-first",
        listLayoutReady: true,
        viewportHeight: 640,
      }),
    ).toEqual({
      scrollTop: 0,
      layoutGeneration: "feed-first",
      viewportHeight: 640,
    });
  });

  describe("resolveSelectionAfterRowsChange", () => {
    const previous = { feedIds: ["a", "b", "c"], viewKey: "all\n" };

    it("hands the selection to the next surviving row, else the previous one", () => {
      expect(
        resolveSelectionAfterRowsChange({
          previous,
          visibleFeedIds: ["a", "c"],
          viewKey: "all\n",
          selectedFeedId: "b",
        }),
      ).toBe("c");
      expect(
        resolveSelectionAfterRowsChange({
          previous,
          visibleFeedIds: ["a", "b"],
          viewKey: "all\n",
          selectedFeedId: "c",
        }),
      ).toBe("b");
      expect(
        resolveSelectionAfterRowsChange({ previous, visibleFeedIds: ["c"], viewKey: "all\n", selectedFeedId: "a" }),
      ).toBe("c");
    });

    it("restarts from the first visible row when the view changed or there is no previous order", () => {
      expect(
        resolveSelectionAfterRowsChange({
          previous,
          visibleFeedIds: ["a", "c"],
          viewKey: "stale\n",
          selectedFeedId: "b",
        }),
      ).toBe("a");
      expect(
        resolveSelectionAfterRowsChange({
          previous: null,
          visibleFeedIds: ["a", "c"],
          viewKey: "all\n",
          selectedFeedId: "b",
        }),
      ).toBe("a");
      expect(
        resolveSelectionAfterRowsChange({
          previous,
          visibleFeedIds: ["a", "c"],
          viewKey: "all\n",
          selectedFeedId: null,
        }),
      ).toBe("a");
    });
  });
});
