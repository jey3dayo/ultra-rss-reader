import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { useSubscriptionsIndexState } from "@/components/subscriptions-index/use-subscriptions-index-state";
import { buildSubscriptionListRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import { useSubscriptionReviewStore } from "@/stores/subscription-review-store";

setupBrowserTestDom();

const ACCOUNT_ID = "acc-1";

function seedKept(accountId: string, ...feedIds: string[]) {
  for (const feedId of feedIds) {
    useSubscriptionReviewStore.getState().keep(accountId, feedId);
  }
}

beforeEach(() => {
  useSubscriptionReviewStore.setState({ kept: new Map() });
});

afterEach(cleanup);

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

function makeFolderRow(feedId: string, folderId: string): SubscriptionListRow {
  const feed: FeedDto = {
    id: feedId,
    account_id: "acc-1",
    folder_id: folderId,
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
    folderNameById: new Map([[folderId, "Folder"]]),
  });

  if (!row) {
    throw new Error(`Failed to build subscription row for ${feedId}`);
  }

  return row;
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

  it("applies the stale return filter and kept feeds before restoring selection", async () => {
    const reviewRow = makeRow("feed-review", {
      tone: "high",
      labelKey: "stale_90d",
    });
    const normalRow = makeRow("feed-normal");
    seedKept(ACCOUNT_ID, "feed-review");
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([reviewRow, normalRow], {
        accountId: ACCOUNT_ID,
        initialSummaryFilter: "stale",
        initialSelectedFeedId: "feed-review",
      }),
    );

    await waitFor(() => {
      expect(result.current.activeSummaryFilter).toBe("stale");
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
      result.current.setActiveSummaryFilter("stale");
    });

    expect(result.current.activeSummaryFilter).toBe("stale");
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

  describe("selection after a row leaves the list", () => {
    const alpha = makeRow("alpha");
    const beta = makeRow("beta");
    const gamma = makeRow("gamma");

    it("hands the selection to the next row when the selected row is removed", async () => {
      const { result, rerender } = renderHook(
        ({ rows }: { rows: SubscriptionListRow[] }) =>
          useSubscriptionsIndexState(rows, { initialSelectedFeedId: "beta" }),
        { initialProps: { rows: [alpha, beta, gamma] } },
      );

      rerender({ rows: [alpha, gamma] });
      await waitFor(() => expect(result.current.selectedFeedId).toBe("gamma"));
    });

    it("selects the previous row when the removed selection was last", async () => {
      const { result, rerender } = renderHook(
        ({ rows }: { rows: SubscriptionListRow[] }) =>
          useSubscriptionsIndexState(rows, { initialSelectedFeedId: "gamma" }),
        { initialProps: { rows: [alpha, beta, gamma] } },
      );

      rerender({ rows: [alpha, beta] });

      await waitFor(() => expect(result.current.selectedFeedId).toBe("beta"));
    });

    describe("across folders, following the order the list is drawn in", () => {
      const inFolder = (feedId: string, folderName: string) => ({
        ...makeRow(feedId),
        folderId: `folder-${folderName}`,
        folderName,
      });
      // Title order is alpha, beta, delta, gamma; the list draws folder "Alpha" (beta, delta) before "Zeta" (alpha, gamma).
      const alpha = inFolder("alpha", "Zeta");
      const beta = inFolder("beta", "Alpha");
      const delta = inFolder("delta", "Alpha");
      const gamma = inFolder("gamma", "Zeta");

      it("selects the row drawn after the removed one even when title order says otherwise", async () => {
        const { result, rerender } = renderHook(
          ({ rows }: { rows: SubscriptionListRow[] }) =>
            useSubscriptionsIndexState(rows, { initialSelectedFeedId: "delta", noFolderLabel: "None" }),
          { initialProps: { rows: [alpha, beta, delta, gamma] } },
        );

        rerender({ rows: [alpha, beta, gamma] });

        await waitFor(() => expect(result.current.selectedFeedId).toBe("alpha"));
      });

      it("selects the row drawn before the removed last one even when title order says otherwise", async () => {
        const { result, rerender } = renderHook(
          ({ rows }: { rows: SubscriptionListRow[] }) =>
            useSubscriptionsIndexState(rows, { initialSelectedFeedId: "gamma", noFolderLabel: "None" }),
          { initialProps: { rows: [alpha, beta, delta, gamma] } },
        );

        rerender({ rows: [alpha, beta, delta] });

        await waitFor(() => expect(result.current.selectedFeedId).toBe("alpha"));
      });
    });

    it("moves on to the next stale row, then the previous one, as rows are marked kept", async () => {
      const stale = { labelKey: "stale_90d" } as const;
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([makeRow("alpha", stale), makeRow("beta", stale), makeRow("gamma", stale)], {
          accountId: ACCOUNT_ID,
          initialSummaryFilter: "stale",
          initialSelectedFeedId: "beta",
        }),
      );

      act(() => {
        result.current.markSelectedFeedKept();
      });
      await waitFor(() => expect(result.current.selectedFeedId).toBe("gamma"));

      act(() => {
        result.current.markSelectedFeedKept();
      });
      await waitFor(() => expect(result.current.selectedFeedId).toBe("alpha"));
    });

    it("starts from the first row when a filter change hides the selection", async () => {
      const stale = { labelKey: "stale_90d" } as const;
      const rows = [makeRow("alpha"), makeRow("beta", stale), makeRow("delta"), makeRow("gamma", stale)];
      const { result } = renderHook(() => useSubscriptionsIndexState(rows, { initialSelectedFeedId: "delta" }));

      act(() => {
        result.current.setActiveSummaryFilter("stale");
      });

      await waitFor(() => expect(result.current.selectedFeedId).toBe("beta"));
    });
  });

  describe("single feed bookkeeping", () => {
    const alpha = makeRow("alpha");
    const beta = makeRow("beta");
    const gamma = makeRow("gamma");

    it("restores a kept feed without touching other kept or checked feeds", () => {
      seedKept(ACCOUNT_ID, "alpha", "beta");
      const { result } = renderHook(() => useSubscriptionsIndexState([alpha, beta, gamma], { accountId: ACCOUNT_ID }));

      act(() => {
        result.current.toggleFeedChecked("gamma");
      });
      act(() => {
        result.current.unkeepFeed("alpha");
      });

      expect([...result.current.keptFeedIds]).toEqual(["beta"]);
      expect([...result.current.checkedFeedIds]).toEqual(["gamma"]);
    });

    it("purges an unsubscribed feed from kept and checked while staying in bulk mode", () => {
      seedKept(ACCOUNT_ID, "alpha", "beta");
      const { result } = renderHook(() => useSubscriptionsIndexState([alpha, beta, gamma], { accountId: ACCOUNT_ID }));

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
        result.current.toggleFeedChecked("gamma");
      });
      act(() => {
        result.current.purgeUnsubscribedFeed("alpha");
      });

      expect([...result.current.keptFeedIds]).toEqual(["beta"]);
      expect([...result.current.checkedFeedIds]).toEqual(["gamma"]);
      expect(result.current.bulkSelectionMode).toBe(true);

      act(() => {
        result.current.purgeUnsubscribedFeed("gamma");
      });

      expect(result.current.checkedCount).toBe(0);
      expect(result.current.bulkSelectionMode).toBe(true);
    });

    it("keeps a kept feed across remounts and per-account switches", () => {
      const first = renderHook(() =>
        useSubscriptionsIndexState([alpha, beta], { accountId: ACCOUNT_ID, initialSelectedFeedId: "alpha" }),
      );
      act(() => {
        first.result.current.markSelectedFeedKept();
      });
      first.unmount();

      const { result, rerender } = renderHook(
        ({ accountId }: { accountId: string }) => useSubscriptionsIndexState([alpha, beta], { accountId }),
        { initialProps: { accountId: ACCOUNT_ID } },
      );
      expect([...result.current.keptFeedIds]).toEqual(["alpha"]);

      rerender({ accountId: "acc-2" });
      expect([...result.current.keptFeedIds]).toEqual([]);

      rerender({ accountId: ACCOUNT_ID });
      expect([...result.current.keptFeedIds]).toEqual(["alpha"]);
    });
  });

  describe("bulk selection", () => {
    const alpha = makeRow("alpha");
    const beta = makeRow("beta");
    const gamma = makeRow("gamma");
    const rows = [alpha, beta, gamma];

    it("clears checked feeds on both filter-change paths and stays in selection mode", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
      });
      expect(result.current.checkedCount).toBe(1);

      act(() => {
        result.current.setActiveSummaryFilter("stale");
      });
      expect(result.current.checkedCount).toBe(0);
      expect(result.current.bulkSelectionMode).toBe(true);

      act(() => {
        result.current.toggleFeedChecked("alpha");
      });
      expect(result.current.checkedCount).toBe(1);

      act(() => {
        result.current.navigateToSummaryFilter("all");
      });
      expect(result.current.checkedCount).toBe(0);
      expect(result.current.bulkSelectionMode).toBe(true);
    });

    it("keeps the search query on external navigation while clearing the selection", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.setSearchQuery("alpha");
        result.current.setSelectedFeedId("alpha");
      });
      expect(result.current.searchQuery).toBe("alpha");
      expect(result.current.selectedFeedId).toBe("alpha");

      act(() => {
        result.current.navigateToSummaryFilter("stale");
      });

      expect(result.current.activeSummaryFilter).toBe("stale");
      expect(result.current.searchQuery).toBe("alpha");
      expect(result.current.selectedFeedId).toBe(null);
    });

    it("keeps the checked feeds and list scroll when the active summary filter is selected again", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
      });
      const scrollResetKey = result.current.listScrollResetKey;

      act(() => {
        result.current.setActiveSummaryFilter("all");
      });

      expect(result.current.checkedCount).toBe(1);
      expect(result.current.listScrollResetKey).toBe(scrollResetKey);
    });

    it("keeps kept rows out of select-all and reports them as skipped", () => {
      seedKept(ACCOUNT_ID, "beta");
      const { result } = renderHook(() => useSubscriptionsIndexState(rows, { accountId: ACCOUNT_ID }));

      act(() => {
        result.current.toggleAllVisibleChecked();
      });

      expect([...result.current.checkedFeedIds].sort()).toEqual(["alpha", "gamma"]);
      expect(result.current.skippedKeptCount).toBe(1);
      expect(result.current.allVisibleCheckState).toBe("all");
    });

    it("keeps a kept fetch-error row out of select-all even though the stale filter still shows it", () => {
      const failingRow: SubscriptionListRow = {
        ...makeRow("failing", { labelKey: "stale_90d" }),
        reasonTooltipKey: "fetch_error",
        fetchError: {
          feed_id: "failing",
          last_attempt_at: "2026-04-04T12:00:00Z",
          last_success_at: null,
          error_kind: "network",
          error_count: 2,
          diagnostic_id: null,
        },
      };
      const staleRow = makeRow("stale", { labelKey: "stale_90d" });
      seedKept(ACCOUNT_ID, "failing");
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([failingRow, staleRow], {
          accountId: ACCOUNT_ID,
          initialSummaryFilter: "stale",
        }),
      );

      expect(result.current.visibleRows.map((row) => row.feed.id)).toEqual(["failing", "stale"]);

      act(() => {
        result.current.toggleAllVisibleChecked();
      });

      expect([...result.current.checkedFeedIds]).toEqual(["stale"]);
      expect(result.current.skippedKeptCount).toBe(1);
    });

    it("keeps selections hidden by search and leaves them alone when toggling the visible ones", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.toggleFeedChecked("beta");
        result.current.setSearchQuery("alpha");
      });

      expect(result.current.visibleRows.map((row) => row.feed.id)).toEqual(["alpha"]);
      expect(result.current.checkedCount).toBe(1);
      expect(result.current.hiddenCheckedCount).toBe(1);
      expect(result.current.allVisibleCheckState).toBe("none");

      act(() => {
        result.current.toggleAllVisibleChecked();
      });

      expect([...result.current.checkedFeedIds].sort()).toEqual(["alpha", "beta"]);
      expect(result.current.hiddenCheckedCount).toBe(1);
      expect(result.current.allVisibleCheckState).toBe("all");

      act(() => {
        result.current.toggleAllVisibleChecked();
      });

      expect([...result.current.checkedFeedIds]).toEqual(["beta"]);
    });

    it("reports a partial selection of the visible rows as some", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.toggleFeedChecked("alpha");
      });

      expect(result.current.allVisibleCheckState).toBe("some");

      act(() => {
        result.current.toggleAllVisibleChecked();
      });

      expect([...result.current.checkedFeedIds].sort()).toEqual(["alpha", "beta", "gamma"]);
      expect(result.current.allVisibleCheckState).toBe("all");
    });

    it("unchecks the focused feed when it is marked kept and stays in selection mode", () => {
      const { result } = renderHook(() =>
        useSubscriptionsIndexState(rows, { accountId: ACCOUNT_ID, initialSelectedFeedId: "alpha" }),
      );

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
        result.current.toggleFeedChecked("beta");
        result.current.toggleFeedChecked("gamma");
      });
      act(() => {
        result.current.markSelectedFeedKept();
      });

      expect(result.current.keptFeedIds.has("alpha")).toBe(true);
      expect([...result.current.checkedFeedIds].sort()).toEqual(["beta", "gamma"]);
      expect(result.current.bulkSelectionMode).toBe(true);
    });

    it("drops only succeeded feeds from checked and kept, and keeps failed and hidden selections", () => {
      seedKept(ACCOUNT_ID, "alpha", "beta", "gamma");
      const { result } = renderHook(() => useSubscriptionsIndexState([alpha, beta, gamma], { accountId: ACCOUNT_ID }));

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
        result.current.toggleFeedChecked("beta");
        result.current.toggleFeedChecked("gamma");
        result.current.setSearchQuery("alpha");
      });
      act(() => {
        result.current.applyBulkUnsubscribeResult(["alpha", "gamma"]);
      });

      expect([...result.current.checkedFeedIds]).toEqual(["beta"]);
      expect(result.current.hiddenCheckedCount).toBe(1);
      expect([...result.current.keptFeedIds]).toEqual(["beta"]);
      expect(result.current.bulkSelectionMode).toBe(true);
    });

    it("leaves selection mode once every selected feed was unsubscribed", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
        result.current.toggleFeedChecked("beta");
      });
      act(() => {
        result.current.applyBulkUnsubscribeResult(["alpha", "beta"]);
      });

      expect(result.current.checkedCount).toBe(0);
      expect(result.current.bulkSelectionMode).toBe(false);
    });

    it("keeps feeds checked after the run started when applying the run result", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
        result.current.toggleFeedChecked("beta");
      });
      // The run works from the alpha/beta snapshot; gamma is checked while it runs.
      act(() => {
        result.current.toggleFeedChecked("gamma");
      });
      act(() => {
        result.current.applyBulkUnsubscribeResult(["alpha", "beta"]);
      });

      expect([...result.current.checkedFeedIds]).toEqual(["gamma"]);
      expect(result.current.bulkSelectionMode).toBe(true);
    });

    it("drops feeds that disappeared from rows out of the checked count", () => {
      const { result, rerender } = renderHook(
        ({ currentRows }: { currentRows: SubscriptionListRow[] }) => useSubscriptionsIndexState(currentRows),
        { initialProps: { currentRows: rows } },
      );

      act(() => {
        result.current.toggleFeedChecked("alpha");
        result.current.toggleFeedChecked("beta");
      });
      expect(result.current.checkedCount).toBe(2);

      rerender({ currentRows: [alpha, gamma] });

      expect(result.current.checkedCount).toBe(1);
      expect([...result.current.checkedFeedIds]).toEqual(["alpha"]);
      expect(result.current.bulkTargets.map(({ row }) => row.feed.id)).toEqual(["alpha"]);
    });

    it("clears checked feeds and leaves selection mode when ending selection", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows));

      act(() => {
        result.current.startBulkSelection();
        result.current.toggleFeedChecked("alpha");
      });
      act(() => {
        result.current.endBulkSelection();
      });

      expect(result.current.checkedCount).toBe(0);
      expect(result.current.bulkSelectionMode).toBe(false);
    });
  });

  describe("feed deep link navigation", () => {
    it("selects the target row, expands its folder group, and requests a scroll", () => {
      const target = makeFolderRow("feed-target", "folder-1");
      const other = makeRow("feed-other");
      const groupKey = "subscription-list:1-folder:folder-1";
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([other, target], {
          initialExpandedGroups: { [`group:${groupKey}`]: false },
        }),
      );
      expect(result.current.isGroupExpanded(groupKey)).toBe(false);

      act(() => {
        result.current.navigateToFeed("feed-target");
      });

      expect(result.current.selectedFeedId).toBe("feed-target");
      expect(result.current.isGroupExpanded(groupKey)).toBe(true);
      expect(result.current.feedScrollRequest).toEqual({ feedId: "feed-target", sequence: 1 });
    });

    it("clears the filter and search when they hide the target row", () => {
      const target = makeRow("feed-target");
      const stale = makeRow("feed-stale", { labelKey: "stale_90d" });
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([target, stale], {
          initialSummaryFilter: "stale",
          initialSearchQuery: "feed-stale",
        }),
      );
      expect(result.current.visibleRows.map((row) => row.feed.id)).toEqual(["feed-stale"]);

      act(() => {
        result.current.navigateToFeed("feed-target");
      });

      expect(result.current.activeSummaryFilter).toBe("all");
      expect(result.current.searchQuery).toBe("");
      expect(result.current.selectedFeedId).toBe("feed-target");
      expect(result.current.visibleRows.map((row) => row.feed.id)).toContain("feed-target");
    });

    it("keeps the active filter when the target row is already visible under it", () => {
      const target = makeRow("feed-target", { labelKey: "stale_90d" });
      const { result } = renderHook(() => useSubscriptionsIndexState([target], { initialSummaryFilter: "stale" }));

      act(() => {
        result.current.navigateToFeed("feed-target");
      });

      expect(result.current.activeSummaryFilter).toBe("stale");
      expect(result.current.selectedFeedId).toBe("feed-target");
    });

    it("waits for the rows to be ready before applying the navigation", () => {
      const target = makeRow("feed-target");
      const { result, rerender } = renderHook(
        ({ selectionReady }: { selectionReady: boolean }) => useSubscriptionsIndexState([target], { selectionReady }),
        { initialProps: { selectionReady: false } },
      );

      act(() => {
        result.current.navigateToFeed("feed-target");
      });
      expect(result.current.feedScrollRequest).toBeNull();

      rerender({ selectionReady: true });

      expect(result.current.selectedFeedId).toBe("feed-target");
      expect(result.current.feedScrollRequest?.feedId).toBe("feed-target");
    });

    it("keeps the queued target selection when readiness flips with several rows loaded", () => {
      const first = makeRow("feed-alpha");
      const target = makeRow("feed-target");
      const { result, rerender } = renderHook(
        ({ selectionReady }: { selectionReady: boolean }) =>
          useSubscriptionsIndexState([first, target], { selectionReady }),
        { initialProps: { selectionReady: false } },
      );

      act(() => {
        result.current.navigateToFeed("feed-target");
      });
      rerender({ selectionReady: true });

      expect(result.current.selectedFeedId).toBe("feed-target");
      expect(result.current.feedScrollRequest?.feedId).toBe("feed-target");
    });

    it("retires the scroll request when the user changes the search after landing", () => {
      const first = makeRow("feed-alpha");
      const target = makeRow("feed-target");
      const { result } = renderHook(() => useSubscriptionsIndexState([first, target]));

      act(() => {
        result.current.navigateToFeed("feed-target");
      });
      expect(result.current.feedScrollRequest?.feedId).toBe("feed-target");

      act(() => {
        result.current.setSearchQuery("feed-alpha");
      });

      expect(result.current.feedScrollRequest).toBeNull();
    });

    it("keeps the scroll request through the navigation's own layout reset but retires it on the next one", () => {
      const target = makeRow("feed-target");
      const stale = makeRow("feed-stale", { labelKey: "stale_90d" });
      const { result, rerender } = renderHook(
        ({ currentRows }: { currentRows: SubscriptionListRow[] }) =>
          useSubscriptionsIndexState(currentRows, {
            initialSummaryFilter: "stale",
            initialSearchQuery: "feed-stale",
          }),
        { initialProps: { currentRows: [target, stale] } },
      );

      act(() => {
        result.current.navigateToFeed("feed-target");
      });
      // Clearing the filter/search changes the layout generation, so the
      // navigation's own scroll reset must not retire the request.
      expect(result.current.feedScrollRequest?.feedId).toBe("feed-target");

      rerender({ currentRows: [target] });

      expect(result.current.feedScrollRequest).toBeNull();
    });

    it("drops the navigation when the feed is not in the loaded rows", () => {
      const row = makeRow("feed-only");
      const { result } = renderHook(() => useSubscriptionsIndexState([row]));

      act(() => {
        result.current.navigateToFeed("feed-missing");
      });

      expect(result.current.feedScrollRequest).toBeNull();
      expect(result.current.selectedFeedId).toBe("feed-only");
    });
  });
});
