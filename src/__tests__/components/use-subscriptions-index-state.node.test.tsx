import { act, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { useSubscriptionsIndexState } from "@/components/subscriptions-index/use-subscriptions-index-state";
import { buildSubscriptionListRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

setupBrowserTestDom();

function makeRow(
  feedId: string,
  status: SubscriptionListRow["status"] = {
    tone: "neutral",
    labelKey: "normal",
  },
): SubscriptionListRow {
  const feed: FeedDto = {
    id: feedId,
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: feedId,
    url: `https://example.com/${feedId}.xml`,
    site_url: `https://example.com/${feedId}`,
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
    status,
  };
}

describe("useSubscriptionsIndexState", () => {
  it("moves selection to the first visible row when the selected feed disappears", async () => {
    const firstRow = makeRow("feed-first");
    const selectedRow = makeRow("feed-selected");
    const { result, rerender } = renderHook(
      ({ rows }: { rows: SubscriptionListRow[] }) =>
        useSubscriptionsIndexState(rows, {
          initialSelectedFeedId: "feed-selected",
        }),
      {
        initialProps: { rows: [firstRow, selectedRow] },
      },
    );

    expect(result.current.selectedFeedId).toBe("feed-selected");
    expect(result.current.selectedRow?.feed.id).toBe("feed-selected");

    rerender({ rows: [firstRow] });

    await waitFor(() => {
      expect(result.current.selectedFeedId).toBe("feed-first");
      expect(result.current.selectedRow?.feed.id).toBe("feed-first");
    });
  });

  it("clears selection when the selected feed disappears and no rows are visible", async () => {
    const selectedRow = makeRow("feed-selected");
    const { result, rerender } = renderHook(
      ({ rows }: { rows: SubscriptionListRow[] }) =>
        useSubscriptionsIndexState(rows, {
          initialSelectedFeedId: "feed-selected",
        }),
      {
        initialProps: { rows: [selectedRow] },
      },
    );

    expect(result.current.selectedFeedId).toBe("feed-selected");
    expect(result.current.selectedRow?.feed.id).toBe("feed-selected");

    rerender({ rows: [] });

    await waitFor(() => {
      expect(result.current.selectedFeedId).toBeNull();
      expect(result.current.selectedRow).toBeNull();
      expect(result.current.visibleRows).toEqual([]);
    });
  });

  it("keeps the current selection when it remains visible", () => {
    const firstRow = makeRow("feed-first");
    const selectedRow = makeRow("feed-selected");
    const { result, rerender } = renderHook(
      ({ rows }: { rows: SubscriptionListRow[] }) =>
        useSubscriptionsIndexState(rows, {
          initialSelectedFeedId: "feed-selected",
        }),
      {
        initialProps: { rows: [firstRow, selectedRow] },
      },
    );

    rerender({ rows: [selectedRow, firstRow] });

    expect(result.current.selectedFeedId).toBe("feed-selected");
    expect(result.current.selectedRow?.feed.id).toBe("feed-selected");
  });

  it("defaults groups to expanded and preserves explicit disclosure state across filtering", () => {
    const { result } = renderHook(() => useSubscriptionsIndexState([makeRow("feed-first")]));

    expect(result.current.isGroupExpanded("folder-work")).toBe(true);

    act(() => {
      result.current.toggleGroup("folder-work");
    });

    expect(result.current.isGroupExpanded("folder-work")).toBe(false);

    act(() => {
      result.current.setSearchQuery("missing");
    });

    expect(result.current.visibleRows).toEqual([]);
    expect(result.current.isGroupExpanded("folder-work")).toBe(false);

    act(() => {
      result.current.setSearchQuery("");
    });

    expect(result.current.visibleRows.map((row) => row.feed.id)).toEqual(["feed-first"]);
    expect(result.current.isGroupExpanded("folder-work")).toBe(false);
  });

  it("keeps group disclosure state isolated by group key", () => {
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([makeRow("feed-first")], {
        initialExpandedGroups: {
          "group:folder-a": false,
          "group:folder-b": true,
        },
      }),
    );

    expect(result.current.isGroupExpanded("folder-a")).toBe(false);
    expect(result.current.isGroupExpanded("folder-b")).toBe(true);
    expect(result.current.isGroupExpanded("folder-c")).toBe(true);

    act(() => {
      result.current.toggleGroup("folder-b");
    });

    expect(result.current.isGroupExpanded("folder-a")).toBe(false);
    expect(result.current.isGroupExpanded("folder-b")).toBe(false);
    expect(result.current.isGroupExpanded("folder-c")).toBe(true);
  });

  it("ignores non-namespaced returned group disclosure keys", () => {
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([makeRow("feed-first")], {
        initialExpandedGroups: {
          "group:folder-a": false,
          all: false,
        },
      }),
    );

    expect(result.current.isGroupExpanded("folder-a")).toBe(false);
    expect(result.current.isGroupExpanded("all")).toBe(true);
  });

  it("applies return-state summary filter and kept feeds before restoring selection", async () => {
    const reviewRow = makeRow("feed-review", {
      tone: "medium",
      labelKey: "review",
    });
    const normalRow = makeRow("feed-normal");
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([reviewRow, normalRow], {
        initialSummaryFilter: "review",
        initialSelectedFeedId: "feed-review",
        initialKeptFeedIds: ["feed-review"],
        initialDeferredFeedIds: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.activeSummaryFilter).toBe("review");
      expect(result.current.visibleRows).toEqual([]);
      expect(result.current.selectedFeedId).toBeNull();
      expect(result.current.selectedRow).toBeNull();
    });
  });

  it("restores the returned list scroll position until the summary filter changes", () => {
    const row = makeRow("feed-first");
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([row], {
        initialListScrollState: {
          scrollTop: 48,
          layoutGeneration: row.feed.id,
          viewportHeight: 640,
        },
        viewportHeight: 640,
      }),
    );

    expect(result.current.listScrollTop).toBe(48);
    expect(result.current.listScrollState).toEqual({
      scrollTop: 48,
      layoutGeneration: "feed-first",
      viewportHeight: 640,
    });

    act(() => {
      result.current.setActiveSummaryFilter("review");
    });

    expect(result.current.activeSummaryFilter).toBe("review");
    expect(result.current.listScrollTop).toBe(0);
  });

  it("drops returned list scroll when the layout generation or viewport height changed", () => {
    const firstRow = makeRow("feed-first");
    const secondRow = makeRow("feed-second");
    const { result, rerender } = renderHook(
      ({ rows, viewportHeight }: { rows: SubscriptionListRow[]; viewportHeight: number }) =>
        useSubscriptionsIndexState(rows, {
          initialListScrollState: {
            scrollTop: 120,
            layoutGeneration: "feed-missing",
            viewportHeight: 640,
          },
          viewportHeight,
        }),
      {
        initialProps: { rows: [firstRow], viewportHeight: 640 },
      },
    );

    expect(result.current.listScrollTop).toBe(0);

    act(() => {
      result.current.setListScrollTop(96);
    });

    expect(result.current.listScrollTop).toBe(96);

    rerender({ rows: [firstRow, secondRow], viewportHeight: 640 });

    expect(result.current.listScrollTop).toBe(0);

    act(() => {
      result.current.setListScrollTop(72);
    });

    rerender({ rows: [firstRow, secondRow], viewportHeight: 700 });

    expect(result.current.listScrollTop).toBe(0);
  });

  it("normalizes negative list scroll updates and returned scroll state", () => {
    const row = makeRow("feed-first");
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([row], {
        initialListScrollState: {
          scrollTop: -1,
          layoutGeneration: row.feed.id,
          viewportHeight: 640,
        },
        viewportHeight: 640,
      }),
    );

    expect(result.current.listScrollTop).toBe(0);

    act(() => {
      result.current.setListScrollTop(-10);
    });

    expect(result.current.listScrollTop).toBe(0);
  });

  it("resets the list scroll position when the search query changes", () => {
    const { result } = renderHook(() => useSubscriptionsIndexState([makeRow("feed-first")]));

    act(() => {
      result.current.setListScrollTop(72);
    });

    expect(result.current.listScrollTop).toBe(72);

    act(() => {
      result.current.setSearchQuery("first");
    });

    expect(result.current.searchQuery).toBe("first");
    expect(result.current.listScrollTop).toBe(0);
  });

  it("keeps search and sort as local state and resets scroll when sort changes", () => {
    const { result } = renderHook(() => useSubscriptionsIndexState([makeRow("feed-first")]));

    expect(result.current.searchQuery).toBe("");
    expect(result.current.sortKey).toBe("title");

    act(() => {
      result.current.setSearchQuery("first");
      result.current.setSortKey("updated_at");
      result.current.setListScrollTop(72);
    });

    expect(result.current.searchQuery).toBe("first");
    expect(result.current.sortKey).toBe("updated_at");
    expect(result.current.listScrollTop).toBe(72);

    act(() => {
      result.current.setSortKey("unread_count");
    });

    expect(result.current.sortKey).toBe("unread_count");
    expect(result.current.listScrollTop).toBe(0);
  });

  it("does not restore search and sort from return state across hook remounts", () => {
    const firstRow = makeRow("feed-first");
    const secondRow = makeRow("feed-second");
    const { result, unmount } = renderHook(() => useSubscriptionsIndexState([secondRow, firstRow]));

    act(() => {
      result.current.setSearchQuery("second");
      result.current.setSortKey("updated_at");
    });

    expect(result.current.searchQuery).toBe("second");
    expect(result.current.sortKey).toBe("updated_at");
    expect(result.current.visibleRows.map((row) => row.feed.id)).toEqual(["feed-second"]);

    unmount();

    const restored = renderHook(() =>
      useSubscriptionsIndexState([secondRow, firstRow], {
        initialSelectedFeedId: "feed-second",
      }),
    );

    expect(restored.result.current.searchQuery).toBe("");
    expect(restored.result.current.sortKey).toBe("title");
    expect(restored.result.current.visibleRows.map((row) => row.feed.id)).toEqual(["feed-first", "feed-second"]);
    expect(restored.result.current.selectedFeedId).toBe("feed-second");

    restored.unmount();
  });

  it("keeps kept and deferred decisions mutually exclusive for the selected row", () => {
    const reviewRow = makeRow("feed-review", {
      tone: "medium",
      labelKey: "review",
    });
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([reviewRow], {
        initialSelectedFeedId: "feed-review",
        initialKeptFeedIds: ["feed-review"],
        initialDeferredFeedIds: [],
      }),
    );

    act(() => {
      result.current.markSelectedFeedDeferred();
    });

    expect(result.current.deferredFeedIds.has("feed-review")).toBe(true);
    expect(result.current.keptFeedIds.has("feed-review")).toBe(false);

    act(() => {
      result.current.markSelectedFeedKept();
    });

    expect(result.current.keptFeedIds.has("feed-review")).toBe(true);
    expect(result.current.deferredFeedIds.has("feed-review")).toBe(false);
  });

  it("resets account-scoped decisions when the active account changes", async () => {
    const reviewRow = makeRow("feed-review", {
      tone: "medium",
      labelKey: "review",
    });
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useSubscriptionsIndexState([reviewRow], {
          accountId,
          initialSummaryFilter: "review",
          initialSelectedFeedId: "feed-review",
          initialKeptFeedIds: ["feed-review"],
          initialDeferredFeedIds: [],
          initialListScrollState: {
            scrollTop: 64,
            layoutGeneration: "feed-review",
            viewportHeight: 640,
          },
          viewportHeight: 640,
        }),
      {
        initialProps: { accountId: "acc-1" },
      },
    );

    expect(result.current.visibleRows).toEqual([]);
    expect(result.current.keptFeedIds.has("feed-review")).toBe(true);

    rerender({ accountId: "acc-2" });

    await waitFor(() => {
      expect(result.current.activeSummaryFilter).toBe("all");
      expect(result.current.keptFeedIds.size).toBe(0);
      expect(result.current.deferredFeedIds.size).toBe(0);
      expect(result.current.listScrollTop).toBe(0);
      expect(result.current.selectedFeedId).toBe("feed-review");
    });
  });
});
