import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import type { SubscriptionsBulkRunStatus } from "@/components/subscriptions-index/subscriptions-bulk-run-status";
import type { SubscriptionsBulkSelection } from "@/components/subscriptions-index/subscriptions-bulk-selection";
import type { SubscriptionsFilterBarProps } from "@/components/subscriptions-index/subscriptions-filter-bar";
import { SubscriptionsListPane } from "@/components/subscriptions-index/subscriptions-list-pane";
import type {
  SubscriptionsActionableStatusLabels,
  SubscriptionsKeptMarker,
  SubscriptionsLatestArticleLabels,
} from "@/components/subscriptions-index/subscriptions-list-row";
import type { SubscriptionsListLoadState } from "@/components/subscriptions-index/subscriptions-load-status";
import type { SubscriptionListGroup, SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

function buildFeed(overrides: Partial<FeedDto>): FeedDto {
  return {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Example Feed",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    ...overrides,
    icon_url: overrides.icon_url ?? null,
  };
}

const statusLabels = {
  attention_30d: "注意",
  stale_90d: "長期未更新",
  quiet_no_unread: "静か",
} satisfies SubscriptionsActionableStatusLabels;

const latestArticleLabels = {
  srPrefix: "RSS上の最終更新",
  none: "取得記事なし",
  formatDaysAgo: (days) => (days === 0 ? "今日" : `${days}日前`),
} satisfies SubscriptionsLatestArticleLabels;

const reasonTooltipLabels = {
  no_articles: "記事がまだ取れていないため、見直し候補にはしていません",
  attention_30d: "最終記事から30日以上たっているため注意表示です",
  stale_90d: "最後に取得した記事から90日以上経過しています",
  quiet_no_unread: "更新停止が続いていて、未読もありません",
} satisfies Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;

function renderListPane(
  rows: SubscriptionListRow[],
  options?: {
    groups?: SubscriptionListGroup[];
    initialScrollTop?: number;
    scrollResetKey?: number;
    isGroupExpanded?: (groupKey: string) => boolean;
    onSelectFeed?: (feedId: string) => void;
    onListScrollTopChange?: (scrollTop: number) => void;
    reasonTooltipLabels?: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
    kept?: SubscriptionsKeptMarker;
    bulkSelection?: SubscriptionsBulkSelection;
    bulkRunStatus?: SubscriptionsBulkRunStatus | null;
    loadState?: SubscriptionsListLoadState;
    filterBar?: SubscriptionsFilterBarProps;
  },
) {
  const groups: SubscriptionListGroup[] = options?.groups ?? [
    { key: "__ungrouped__", label: "フォルダなし", folderId: null, rows },
  ];

  return render(
    <SubscriptionsListPane
      heading="全購読"
      groups={groups}
      selectedFeedId={rows[0]?.feed.id ?? null}
      emptyLabel="一致する購読はありません。"
      searchQuery=""
      searchLabel="購読を検索"
      searchPlaceholder="検索"
      searchClearLabel="検索をクリア"
      statusLabels={statusLabels}
      reasonTooltipLabels={options?.reasonTooltipLabels ?? reasonTooltipLabels}
      formatUnreadCountLabel={(count) => `未読 ${count}件`}
      latestArticleLabels={latestArticleLabels}
      isGroupExpanded={options?.isGroupExpanded ?? (() => true)}
      initialScrollTop={options?.initialScrollTop}
      scrollResetKey={options?.scrollResetKey}
      kept={options?.kept}
      bulkSelection={options?.bulkSelection}
      bulkRunStatus={options?.bulkRunStatus}
      loadState={options?.loadState}
      filterBar={options?.filterBar}
      onSelectFeed={options?.onSelectFeed ?? vi.fn()}
      onListScrollTopChange={options?.onListScrollTopChange}
      onSearchQueryChange={vi.fn()}
      onToggleGroup={vi.fn()}
    />,
  );
}

function buildBulkSelection(overrides: Partial<SubscriptionsBulkSelection> = {}): SubscriptionsBulkSelection {
  return {
    mode: true,
    checkedFeedIds: new Set(),
    checkedCount: 0,
    hiddenCheckedCount: 0,
    allVisibleCheckState: "none",
    skippedKeptCount: 0,
    toggleButtonRef: { current: null },
    labels: {
      start: "まとめて選択",
      end: "選択を終了",
      selectAllVisible: (count) => `表示中をすべて選択(${count}件)`,
      selectAllVisibleAria: "表示中の購読をすべて選択",
      skippedKept: (count) => `見直し対象外の${count}件は含みません`,
      rowSelectAria: (title) => `${title}を選択`,
      selectedCount: (count) => `${count}件を選択中`,
      selectedCountHidden: (count, hidden) => `${count}件を選択中(検索で非表示${hidden}件)`,
      unsubscribeAction: "購読解除…",
    },
    onStart: vi.fn(),
    onEnd: vi.fn(),
    onToggleFeed: vi.fn(),
    onToggleAllVisible: vi.fn(),
    onRequestUnsubscribe: vi.fn(),
    ...overrides,
  };
}

function buildBulkRows(): SubscriptionListRow[] {
  return ["alpha", "beta"].map((id) => ({
    feed: buildFeed({ id, title: `${id} feed` }),
    folderId: null,
    folderName: null,
    latestArticleAt: null,
    latestArticleDays: null,
    recentArticleCount: 0,
    status: { labelKey: "normal" },
    reasonTooltipKey: null,
  }));
}

describe("SubscriptionsListPane bulk selection", () => {
  it("shows no checkboxes or action bar until selection mode starts, and offers the start toggle", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    renderListPane(buildBulkRows(), { bulkSelection: buildBulkSelection({ mode: false, onStart }) });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "まとめて選択" }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("toggles the same header button into an end action while selecting", async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();
    renderListPane(buildBulkRows(), { bulkSelection: buildBulkSelection({ onEnd }) });

    const section = screen.getByRole("region", { name: "全購読" });
    const headerToggle = within(section).getAllByRole("button", { name: "選択を終了" })[0];
    await user.click(headerToggle);

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "まとめて選択" })).not.toBeInTheDocument();
  });

  it("toggles a row checkbox without selecting the row, and still opens the row on click", async () => {
    const user = userEvent.setup();
    const onToggleFeed = vi.fn();
    const onSelectFeed = vi.fn();
    renderListPane(buildBulkRows(), {
      onSelectFeed,
      bulkSelection: buildBulkSelection({ checkedFeedIds: new Set(["beta"]), checkedCount: 1, onToggleFeed }),
    });

    expect(screen.getByRole("checkbox", { name: "alpha feedを選択" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "beta feedを選択" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "alpha feedを選択" }));
    expect(onToggleFeed).toHaveBeenCalledExactlyOnceWith("alpha");
    expect(onSelectFeed).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /alpha feed/ }));
    expect(onSelectFeed).toHaveBeenCalledExactlyOnceWith("alpha");
    expect(onToggleFeed).toHaveBeenCalledTimes(1);
  });

  it("keeps the row checkbox outside the row button", () => {
    renderListPane(buildBulkRows(), { bulkSelection: buildBulkSelection() });

    const checkbox = screen.getByRole("checkbox", { name: "alpha feedを選択" });
    expect(checkbox.closest("button")).toBeNull();
  });

  it("reflects the select-all state as checked or indeterminate and toggles it", async () => {
    const user = userEvent.setup();
    const onToggleAllVisible = vi.fn();
    renderListPane(buildBulkRows(), {
      bulkSelection: buildBulkSelection({ allVisibleCheckState: "some", onToggleAllVisible }),
    });

    const selectAll = screen.getByRole("checkbox", { name: "表示中の購読をすべて選択" });
    expect(selectAll).toHaveAttribute("aria-checked", "mixed");
    expect(screen.getByText("表示中をすべて選択(2件)")).toBeInTheDocument();

    await user.click(screen.getByText("表示中をすべて選択(2件)"));
    expect(onToggleAllVisible).toHaveBeenCalledTimes(1);
  });

  it("shows select-all as checked when every visible row is checked", () => {
    renderListPane(buildBulkRows(), { bulkSelection: buildBulkSelection({ allVisibleCheckState: "all" }) });

    expect(screen.getByRole("checkbox", { name: "表示中の購読をすべて選択" })).toBeChecked();
  });

  it("notes skipped excluded feeds only when some were skipped", () => {
    const { unmount } = renderListPane(buildBulkRows(), {
      bulkSelection: buildBulkSelection({ skippedKeptCount: 1 }),
    });
    expect(screen.getByText("見直し対象外の1件は含みません")).toBeInTheDocument();
    unmount();

    renderListPane(buildBulkRows(), { bulkSelection: buildBulkSelection() });
    expect(screen.queryByText(/含みません/)).not.toBeInTheDocument();
  });

  it("marks excluded rows with a chip outside selection mode too", () => {
    const kept = { feedIds: new Set(["alpha"]), chipLabel: "見直し対象外" };
    const { unmount } = renderListPane(buildBulkRows(), {
      kept,
      bulkSelection: buildBulkSelection({ mode: false, skippedKeptCount: 1 }),
    });
    expect(within(screen.getByRole("button", { name: /alpha feed/ })).getByText("見直し対象外")).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /beta feed/ })).queryByText("見直し対象外"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/含みません/)).not.toBeInTheDocument();
    unmount();

    renderListPane(buildBulkRows(), { kept, bulkSelection: buildBulkSelection({ skippedKeptCount: 1 }) });
    expect(within(screen.getByRole("button", { name: /alpha feed/ })).getByText("見直し対象外")).toBeInTheDocument();
  });

  it("disables the unsubscribe action until something is checked and routes the request", async () => {
    const user = userEvent.setup();
    const onRequestUnsubscribe = vi.fn();
    const { unmount } = renderListPane(buildBulkRows(), {
      bulkSelection: buildBulkSelection({ onRequestUnsubscribe }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("0件を選択中");
    expect(screen.getByRole("button", { name: "購読解除…" })).toBeDisabled();
    unmount();

    renderListPane(buildBulkRows(), {
      bulkSelection: buildBulkSelection({ checkedFeedIds: new Set(["alpha"]), checkedCount: 1, onRequestUnsubscribe }),
    });
    await user.click(screen.getByRole("button", { name: "購読解除…" }));

    expect(onRequestUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("tells how many checked feeds are hidden by the current search", () => {
    renderListPane(buildBulkRows(), {
      bulkSelection: buildBulkSelection({ checkedCount: 3, hiddenCheckedCount: 2 }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("3件を選択中(検索で非表示2件)");
  });

  it("shows the bulk unsubscribe progress with stop and details actions while a run is in flight", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const onShowDetails = vi.fn();
    renderListPane(buildBulkRows(), {
      bulkRunStatus: {
        done: 1,
        total: 3,
        waitingForSync: true,
        stopRequested: false,
        labels: {
          status: (done, total) => `購読を解除しています：${done} / ${total}件`,
          waiting: "同期などの処理が終わるのを待っています。終わり次第、自動で続けます。",
          showDetails: "詳細を表示",
          stop: "中止",
          stopping: "中止しています…",
        },
        onStop,
        onShowDetails,
      },
    });

    expect(screen.getByRole("status")).toHaveTextContent("購読を解除しています：1 / 3件");
    expect(
      screen.getByText("同期などの処理が終わるのを待っています。終わり次第、自動で続けます。"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "詳細を表示" }));
    expect(onShowDetails).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "中止" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe("SubscriptionsListPane", () => {
  it("names the list pane region from its visible heading", () => {
    renderListPane([
      {
        feed: buildFeed({ title: "Named Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        latestArticleDays: null,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: null,
      },
    ]);

    expect(screen.getByRole("region", { name: "全購読" })).toBeInTheDocument();
  });

  it("explains the active filter criteria in the empty state", () => {
    const criteria = "直近30日で20本以上かつ未読50件以上";
    renderListPane([], {
      groups: [],
      filterBar: {
        model: {
          ariaLabel: "購読の絞り込み",
          options: [{ filterKey: "frequent", label: "更新過多", count: 0, isActive: true, tooltip: criteria }],
          activeDescription: criteria,
        },
        onSelect: vi.fn(),
      },
    });

    expect(screen.getByRole("status")).toHaveTextContent("一致する購読はありません。");
    expect(screen.getAllByText(criteria)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /^更新過多/ })).toHaveAccessibleDescription(criteria);
  });

  it("does not add a duplicate clear button to the search input", () => {
    const row = {
      feed: buildFeed({ title: "Searchable Feed" }),
      folderId: null,
      folderName: null,
      latestArticleAt: null,
      latestArticleDays: null,
      recentArticleCount: 0,
      status: { labelKey: "normal" },
      reasonTooltipKey: null,
    } satisfies SubscriptionListRow;

    render(
      <SubscriptionsListPane
        heading="全購読"
        groups={[{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows: [row] }]}
        selectedFeedId={row.feed.id}
        emptyLabel="一致する購読はありません。"
        searchQuery="Search"
        searchLabel="購読を検索"
        searchPlaceholder="検索"
        searchClearLabel="検索をクリア"
        statusLabels={statusLabels}
        reasonTooltipLabels={reasonTooltipLabels}
        formatUnreadCountLabel={(count) => `未読 ${count}件`}
        latestArticleLabels={latestArticleLabels}
        isGroupExpanded={() => true}
        onSelectFeed={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onToggleGroup={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "検索をクリア" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "購読を検索" })).toHaveClass("h-11", "pl-10", "pr-3");
  });

  it("offers a clear-search recovery action when a query returns no subscriptions", async () => {
    const user = userEvent.setup();
    const onSearchQueryChange = vi.fn();

    render(
      <SubscriptionsListPane
        heading="全購読"
        groups={[{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows: [] }]}
        selectedFeedId={null}
        emptyLabel="一致する購読はありません。"
        searchQuery="Missing"
        searchLabel="購読を検索"
        searchPlaceholder="検索"
        searchClearLabel="検索をクリア"
        statusLabels={statusLabels}
        reasonTooltipLabels={reasonTooltipLabels}
        formatUnreadCountLabel={(count) => `未読 ${count}件`}
        latestArticleLabels={latestArticleLabels}
        isGroupExpanded={() => true}
        onSelectFeed={vi.fn()}
        onSearchQueryChange={onSearchQueryChange}
        onToggleGroup={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("一致する購読はありません。");
    expect(screen.getByRole("button", { name: "検索をクリア" })).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: "検索をクリア" }));

    expect(onSearchQueryChange).toHaveBeenCalledWith("");
  });

  it("shows why a feed with no fetched articles is not a review candidate", async () => {
    const user = userEvent.setup();

    renderListPane([
      {
        feed: buildFeed({ title: "No Article Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        latestArticleDays: null,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: "no_articles",
      },
    ]);

    const row = screen.getByRole("button", { name: /No Article Feed/ });

    await user.hover(row);

    expect(await screen.findByText("記事がまだ取れていないため、見直し候補にはしていません")).toHaveClass(
      "motion-popup-surface",
    );
  });

  it("shows a status chip only when action is needed and the latest article age as a column", () => {
    const base = { folderId: null, folderName: null, recentArticleCount: 0, reasonTooltipKey: null } as const;
    renderListPane([
      {
        ...base,
        feed: buildFeed({ id: "calm", title: "Calm Feed" }),
        latestArticleAt: "2026-05-07T00:00:00Z",
        latestArticleDays: 0,
        status: { labelKey: "normal" },
      },
      {
        ...base,
        feed: buildFeed({ id: "old", title: "Old Feed" }),
        latestArticleAt: "2025-01-01T00:00:00Z",
        latestArticleDays: 120,
        status: { labelKey: "stale_90d" },
      },
      {
        ...base,
        feed: buildFeed({ id: "empty", title: "Empty Feed" }),
        latestArticleAt: null,
        latestArticleDays: null,
        status: { labelKey: "normal" },
      },
    ]);

    const calmRow = screen.getByRole("button", { name: /Calm Feed/ });
    const oldRow = screen.getByRole("button", { name: /Old Feed/ });
    const emptyRow = screen.getByRole("button", { name: /Empty Feed/ });
    expect(calmRow.querySelector("[data-label-chip]")).toBeNull();
    expect(emptyRow.querySelector("[data-label-chip]")).toBeNull();
    expect(within(oldRow).getByText("長期未更新")).toBeInTheDocument();
    expect(oldRow.querySelectorAll("[data-label-chip]")).toHaveLength(1);
    expect(calmRow).toHaveTextContent("今日");
    expect(oldRow).toHaveTextContent("RSS上の最終更新 120日前");
    expect(emptyRow).toHaveTextContent("取得記事なし");
    expect(emptyRow).not.toHaveTextContent("RSS上の最終更新");
  });

  it("shows the active review reason on keyboard focus", async () => {
    const user = userEvent.setup();

    renderListPane([
      {
        feed: buildFeed({ title: "Quiet Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: "2025-01-01T00:00:00Z",
        latestArticleDays: 1,
        recentArticleCount: 0,
        status: { labelKey: "quiet_no_unread" },
        reasonTooltipKey: "quiet_no_unread",
      },
    ]);

    await user.tab();
    await user.tab();
    await user.tab();

    expect(await screen.findByText("更新停止が続いていて、未読もありません")).toHaveClass("motion-popup-surface");
  });

  it("falls back to fetch-error tooltip copy only for a failed row", async () => {
    const user = userEvent.setup();
    const normalRow = {
      feed: buildFeed({ title: "Healthy Feed" }),
      folderId: null,
      folderName: null,
      latestArticleAt: null,
      latestArticleDays: null,
      recentArticleCount: 0,
      status: { labelKey: "normal" },
      reasonTooltipKey: "normal",
    } satisfies SubscriptionListRow;

    const { unmount } = renderListPane([normalRow], { reasonTooltipLabels: {} });
    await user.hover(screen.getByRole("button", { name: /Healthy Feed/ }));
    expect(screen.queryByText("Fetch error")).not.toBeInTheDocument();
    unmount();

    const failedRow: SubscriptionListRow = {
      ...normalRow,
      reasonTooltipKey: "fetch_error",
      fetchError: {
        feed_id: normalRow.feed.id,
        last_attempt_at: "2026-04-04T12:00:00Z",
        last_success_at: null,
        error_kind: "other",
        error_count: 0,
        diagnostic_id: null,
      },
    };
    renderListPane([failedRow], { reasonTooltipLabels: {} });
    await userEvent.setup().hover(screen.getByRole("button", { name: /Healthy Feed/ }));
    await waitFor(() => {
      const fetchErrorText = screen.getAllByText("Fetch error");
      expect(fetchErrorText.some((element) => element.classList.contains("motion-popup-surface"))).toBe(true);
    });
  });

  it("renders folder disclosure rows as an indented section with count", () => {
    renderListPane([
      {
        feed: buildFeed({ title: "Tree Feed", unread_count: 2 }),
        folderId: null,
        folderName: null,
        latestArticleAt: "2026-05-07T00:00:00Z",
        latestArticleDays: 1,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: null,
      },
    ]);

    const folderButton = screen.getByTestId("subscriptions-folder-row-ungrouped");
    expect(folderButton).toHaveAttribute("aria-expanded", "true");
    expect(folderButton).toHaveAttribute("aria-controls", "subscriptions-group-panel-__ungrouped__");
    expect(folderButton).toHaveClass("min-h-11");
    expect(folderButton).toHaveClass("border", "border-transparent");
    expect(folderButton).toHaveTextContent("1");

    const rows = screen.getByTestId("subscriptions-folder-rows-ungrouped");
    expect(rows).toHaveClass("pl-9");
    expect(screen.getByRole("button", { name: /Tree Feed/ })).toHaveClass("motion-list-item-enter");
  });

  it("keeps collapsed folder panels hidden and inert", () => {
    renderListPane(
      [
        {
          feed: buildFeed({ title: "Collapsed Feed" }),
          folderId: null,
          folderName: null,
          latestArticleAt: null,
          latestArticleDays: null,
          recentArticleCount: 0,
          status: { labelKey: "normal" },
          reasonTooltipKey: null,
        },
      ],
      { isGroupExpanded: () => false },
    );

    const folderButton = screen.getByTestId("subscriptions-folder-row-ungrouped");
    const panel = document.getElementById("subscriptions-group-panel-__ungrouped__");

    expect(folderButton).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
  });

  it("restores the list scroll position only when the returned value changes", () => {
    const scrollTopAssignments: number[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");

    Object.defineProperty(Element.prototype, "scrollTop", {
      configurable: true,
      get() {
        return scrollTopAssignments[scrollTopAssignments.length - 1] ?? 0;
      },
      set(value: number) {
        scrollTopAssignments.push(value);
      },
    });

    try {
      const row = {
        feed: buildFeed({ title: "Scroll Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        latestArticleDays: null,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: null,
      } satisfies SubscriptionListRow;

      const { rerender } = renderListPane([row], { initialScrollTop: 42 });

      rerender(
        <SubscriptionsListPane
          heading="全購読"
          groups={[{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows: [row] }]}
          selectedFeedId={row.feed.id}
          emptyLabel="一致する購読はありません。"
          searchQuery=""
          searchLabel="購読を検索"
          searchPlaceholder="検索"
          searchClearLabel="検索をクリア"
          statusLabels={statusLabels}
          reasonTooltipLabels={reasonTooltipLabels}
          formatUnreadCountLabel={(count) => `未読 ${count}件`}
          latestArticleLabels={latestArticleLabels}
          isGroupExpanded={() => true}
          initialScrollTop={42}
          scrollResetKey={0}
          onSelectFeed={vi.fn()}
          onSearchQueryChange={vi.fn()}
          onToggleGroup={vi.fn()}
        />,
      );

      rerender(
        <SubscriptionsListPane
          heading="全購読"
          groups={[{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows: [row] }]}
          selectedFeedId={row.feed.id}
          emptyLabel="一致する購読はありません。"
          searchQuery=""
          searchLabel="購読を検索"
          searchPlaceholder="検索"
          searchClearLabel="検索をクリア"
          statusLabels={statusLabels}
          reasonTooltipLabels={reasonTooltipLabels}
          formatUnreadCountLabel={(count) => `未読 ${count}件`}
          latestArticleLabels={latestArticleLabels}
          isGroupExpanded={() => true}
          initialScrollTop={84}
          scrollResetKey={0}
          onSelectFeed={vi.fn()}
          onSearchQueryChange={vi.fn()}
          onToggleGroup={vi.fn()}
        />,
      );

      expect(scrollTopAssignments).toEqual([42, 84]);
    } finally {
      if (descriptor) {
        Object.defineProperty(Element.prototype, "scrollTop", descriptor);
      } else {
        delete (Element.prototype as { scrollTop?: number }).scrollTop;
      }
    }
  });

  it("delegates feed clicks and batches list scroll position changes through separate callbacks", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onSelectFeed = vi.fn();
      const onListScrollTopChange = vi.fn();
      renderListPane(
        [
          {
            feed: buildFeed({ id: "feed-scroll", title: "Scroll Callback Feed" }),
            folderId: null,
            folderName: null,
            latestArticleAt: null,
            latestArticleDays: null,
            recentArticleCount: 0,
            status: { labelKey: "normal" },
            reasonTooltipKey: null,
          },
        ],
        { onSelectFeed, onListScrollTopChange },
      );
      const scrollRegion = screen.getByTestId("subscriptions-list-scroll-region");

      await user.click(screen.getByRole("button", { name: /Scroll Callback Feed/ }));

      expect(onSelectFeed).toHaveBeenCalledOnce();
      expect(onSelectFeed).toHaveBeenCalledWith("feed-scroll");
      expect(onListScrollTopChange).not.toHaveBeenCalled();

      scrollRegion.scrollTop = 96;
      fireEvent.scroll(scrollRegion);
      scrollRegion.scrollTop = 120;
      fireEvent.scroll(scrollRegion);

      expect(onListScrollTopChange).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(120);

      expect(onListScrollTopChange).toHaveBeenCalledOnce();
      expect(onListScrollTopChange).toHaveBeenCalledWith(120);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes the latest pending list scroll position on unmount", () => {
    vi.useFakeTimers();
    try {
      const onListScrollTopChange = vi.fn();
      const { unmount } = renderListPane(
        [
          {
            feed: buildFeed({ id: "feed-scroll", title: "Scroll Callback Feed" }),
            folderId: null,
            folderName: null,
            latestArticleAt: null,
            latestArticleDays: null,
            recentArticleCount: 0,
            status: { labelKey: "normal" },
            reasonTooltipKey: null,
          },
        ],
        { onListScrollTopChange },
      );
      const scrollRegion = screen.getByTestId("subscriptions-list-scroll-region");

      scrollRegion.scrollTop = 144;
      fireEvent.scroll(scrollRegion);

      expect(onListScrollTopChange).not.toHaveBeenCalled();

      unmount();

      expect(onListScrollTopChange).toHaveBeenCalledOnce();
      expect(onListScrollTopChange).toHaveBeenCalledWith(144);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a pending list scroll position when the restored scroll top changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const onListScrollTopChange = vi.fn();
      const row = {
        feed: buildFeed({ id: "feed-scroll", title: "Scroll Callback Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        latestArticleDays: null,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: null,
      } satisfies SubscriptionListRow;
      const groups = [{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows: [row] }];
      const renderPane = (initialScrollTop: number, scrollResetKey = 0) => (
        <SubscriptionsListPane
          heading="全購読"
          groups={groups}
          selectedFeedId={row.feed.id}
          emptyLabel="一致する購読はありません。"
          searchQuery=""
          searchLabel="購読を検索"
          searchPlaceholder="検索"
          searchClearLabel="検索をクリア"
          statusLabels={statusLabels}
          reasonTooltipLabels={reasonTooltipLabels}
          formatUnreadCountLabel={(count) => `未読 ${count}件`}
          latestArticleLabels={latestArticleLabels}
          isGroupExpanded={() => true}
          initialScrollTop={initialScrollTop}
          scrollResetKey={scrollResetKey}
          onSelectFeed={vi.fn()}
          onListScrollTopChange={onListScrollTopChange}
          onSearchQueryChange={vi.fn()}
          onToggleGroup={vi.fn()}
        />
      );
      const { rerender } = render(renderPane(42));
      const scrollRegion = screen.getByTestId("subscriptions-list-scroll-region");

      scrollRegion.scrollTop = 144;
      fireEvent.scroll(scrollRegion);
      rerender(renderPane(0));

      await vi.advanceTimersByTimeAsync(120);

      expect(onListScrollTopChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a pending list scroll position when reset identity changes with the same restored top", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const onListScrollTopChange = vi.fn();
      const row = {
        feed: buildFeed({ id: "feed-scroll", title: "Scroll Callback Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        latestArticleDays: null,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: null,
      } satisfies SubscriptionListRow;
      const groups = [{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows: [row] }];
      const renderPane = (scrollResetKey: number) => (
        <SubscriptionsListPane
          heading="全購読"
          groups={groups}
          selectedFeedId={row.feed.id}
          emptyLabel="一致する購読はありません。"
          searchQuery=""
          searchLabel="購読を検索"
          searchPlaceholder="検索"
          searchClearLabel="検索をクリア"
          statusLabels={statusLabels}
          reasonTooltipLabels={reasonTooltipLabels}
          formatUnreadCountLabel={(count) => `未読 ${count}件`}
          latestArticleLabels={latestArticleLabels}
          isGroupExpanded={() => true}
          initialScrollTop={0}
          scrollResetKey={scrollResetKey}
          onSelectFeed={vi.fn()}
          onListScrollTopChange={onListScrollTopChange}
          onSearchQueryChange={vi.fn()}
          onToggleGroup={vi.fn()}
        />
      );
      const { rerender } = render(renderPane(0));
      const scrollRegion = screen.getByTestId("subscriptions-list-scroll-region");

      scrollRegion.scrollTop = 144;
      fireEvent.scroll(scrollRegion);
      rerender(renderPane(1));

      await vi.advanceTimersByTimeAsync(120);

      expect(onListScrollTopChange).not.toHaveBeenCalled();
      expect(scrollRegion.scrollTop).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses folder ids for duplicated folder label disclosure ids and test ids", () => {
    const firstRow = {
      feed: buildFeed({ id: "feed-1", title: "Alpha Feed", folder_id: "folder-a" }),
      folderId: "folder-a",
      folderName: "Same Folder",
      latestArticleAt: null,
      latestArticleDays: null,
      recentArticleCount: 0,
      status: { labelKey: "normal" },
      reasonTooltipKey: null,
    } satisfies SubscriptionListRow;
    const secondRow = {
      feed: buildFeed({ id: "feed-2", title: "Beta Feed", folder_id: "folder-b" }),
      folderId: "folder-b",
      folderName: "Same Folder",
      latestArticleAt: null,
      latestArticleDays: null,
      recentArticleCount: 0,
      status: { labelKey: "normal" },
      reasonTooltipKey: null,
    } satisfies SubscriptionListRow;

    renderListPane([], {
      groups: [
        { key: "folder-a", label: "Same Folder", folderId: "folder-a", rows: [firstRow] },
        { key: "folder-b", label: "Same Folder", folderId: "folder-b", rows: [secondRow] },
      ],
    });

    const firstFolderButton = screen.getByTestId("subscriptions-folder-row-folder-a");
    const secondFolderButton = screen.getByTestId("subscriptions-folder-row-folder-b");

    expect(firstFolderButton).toHaveAttribute("aria-controls", "subscriptions-group-panel-folder-a");
    expect(secondFolderButton).toHaveAttribute("aria-controls", "subscriptions-group-panel-folder-b");
    expect(document.getElementById("subscriptions-group-panel-folder-a")).toBeInTheDocument();
    expect(document.getElementById("subscriptions-group-panel-folder-b")).toBeInTheDocument();
    expect(screen.getByTestId("subscriptions-folder-rows-folder-a")).toBeInTheDocument();
    expect(screen.getByTestId("subscriptions-folder-rows-folder-b")).toBeInTheDocument();
  });
});

describe("SubscriptionsListPane load state", () => {
  const loadFailure = {
    message: "購読の一覧を読み込めませんでした。",
    retryLabel: "再試行",
    retrying: false,
    onRetry: vi.fn(),
  };

  it("shows one labelled loading region instead of the empty state or rows while loading", () => {
    renderListPane(buildBulkRows(), {
      loadState: { status: "loading", label: "購読を読み込み中" },
      bulkSelection: buildBulkSelection({ mode: false }),
    });

    expect(screen.getByTestId("subscriptions-list-skeleton")).toHaveTextContent("購読を読み込み中");
    expect(screen.queryByText("一致する購読はありません。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /alpha feed/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "まとめて選択" })).toBeDisabled();
  });

  it("replaces the empty state with a retryable alert when loading failed", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderListPane([], { loadState: { status: "error", failure: { ...loadFailure, onRetry }, hasData: false } });

    expect(screen.getByRole("alert")).toHaveTextContent("購読の一覧を読み込めませんでした。");
    expect(screen.queryByText("一致する購読はありません。")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "再試行" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no selection mode while the list could not be loaded, but still explains an empty match when data is cached", () => {
    const { unmount } = renderListPane([], {
      loadState: { status: "error", failure: loadFailure, hasData: false },
      bulkSelection: buildBulkSelection({ mode: false }),
    });
    expect(screen.getByRole("button", { name: "まとめて選択" })).toBeDisabled();
    unmount();

    renderListPane([], { loadState: { status: "error", failure: loadFailure, hasData: true } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("一致する購読はありません。")).toBeInTheDocument();
  });

  it("keeps the rows beside the alert when a refresh fails and disables retry while it runs", () => {
    renderListPane(buildBulkRows(), {
      loadState: { status: "error", failure: { ...loadFailure, retrying: true }, hasData: true },
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /alpha feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "再試行" })).toHaveAttribute("aria-busy", "true");
  });
});
