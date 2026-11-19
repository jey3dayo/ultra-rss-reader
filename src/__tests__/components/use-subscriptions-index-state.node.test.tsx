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

  it("applies the stale return filter and kept feeds before restoring selection", async () => {
    const reviewRow = makeRow("feed-review", {
      tone: "high",
      labelKey: "stale_90d",
    });
    const normalRow = makeRow("feed-normal");
    const { result } = renderHook(() =>
      useSubscriptionsIndexState([reviewRow, normalRow], {
        initialSummaryFilter: "stale",
        initialSelectedFeedId: "feed-review",
        initialKeptFeedIds: ["feed-review"],
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
      const stale = { tone: "high", labelKey: "stale_90d" } as const;
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([makeRow("alpha", stale), makeRow("beta", stale), makeRow("gamma", stale)], {
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
      const stale = { tone: "high", labelKey: "stale_90d" } as const;
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
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([alpha, beta, gamma], { initialKeptFeedIds: ["alpha", "beta"] }),
      );

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
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([alpha, beta, gamma], { initialKeptFeedIds: ["alpha", "beta"] }),
      );

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

    it("keeps kept rows out of select-all and reports them as skipped", () => {
      const { result } = renderHook(() => useSubscriptionsIndexState(rows, { initialKeptFeedIds: ["beta"] }));

      act(() => {
        result.current.toggleAllVisibleChecked();
      });

      expect([...result.current.checkedFeedIds].sort()).toEqual(["alpha", "gamma"]);
      expect(result.current.skippedKeptCount).toBe(1);
      expect(result.current.allVisibleCheckState).toBe("all");
    });

    it("keeps a kept fetch-error row out of select-all even though the stale filter still shows it", () => {
      const failingRow: SubscriptionListRow = {
        ...makeRow("failing", { tone: "high", labelKey: "stale_90d" }),
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
      const staleRow = makeRow("stale", { tone: "high", labelKey: "stale_90d" });
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([failingRow, staleRow], {
          initialSummaryFilter: "stale",
          initialKeptFeedIds: ["failing"],
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
      const { result } = renderHook(() => useSubscriptionsIndexState(rows, { initialSelectedFeedId: "alpha" }));

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
      const { result } = renderHook(() =>
        useSubscriptionsIndexState([alpha, beta, gamma], {
          initialKeptFeedIds: ["alpha", "beta", "gamma"],
        }),
      );

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
});
