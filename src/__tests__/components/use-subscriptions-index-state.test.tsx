import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { useSubscriptionsIndexState } from "@/components/subscriptions-index/use-subscriptions-index-state";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

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

  return {
    feed,
    folderId: null,
    folderName: null,
    latestArticleAt: null,
    status,
    reasonTooltipKey: null,
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
          "folder-a": false,
          "folder-b": true,
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
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([makeRow("feed-first")], {
        initialListScrollTop: 48,
      }),
    );

    expect(result.current.listScrollTop).toBe(48);

    act(() => {
      result.current.setActiveSummaryFilter("review");
    });

    expect(result.current.activeSummaryFilter).toBe("review");
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
});
