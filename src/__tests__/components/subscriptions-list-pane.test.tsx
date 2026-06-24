import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { SubscriptionsListPane } from "@/components/subscriptions-index/subscriptions-list-pane";
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
  };
}

const statusLabels = {
  normal: "対応不要",
  review: "見直し候補",
  stale_90d: "90日以上更新なし",
  quiet_no_unread: "見直し候補",
} satisfies Record<SubscriptionListRow["status"]["labelKey"], string>;

const reasonTooltipLabels = {
  no_articles: "記事がまだ取れていないため、見直し候補にはしていません",
  normal: "最近も動きがあります。今はそのままでよさそうです。",
  review: "見直しの判断材料があります",
  stale_90d: "最後に取得した記事から90日以上たっています",
  quiet_no_unread: "更新停止が続いていて、未読もありません",
} satisfies Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>;

function renderListPane(
  rows: SubscriptionListRow[],
  options?: {
    groups?: SubscriptionListGroup[];
    initialScrollTop?: number;
    scrollResetKey?: number;
    isGroupExpanded?: (groupKey: string) => boolean;
    onSelectFeed?: (feedId: string) => void;
    onListScrollTopChange?: (scrollTop: number) => void;
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
      reasonTooltipLabels={reasonTooltipLabels}
      formatUnreadCountLabel={(count) => `未読 ${count}件`}
      formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
      isGroupExpanded={options?.isGroupExpanded ?? (() => true)}
      initialScrollTop={options?.initialScrollTop}
      scrollResetKey={options?.scrollResetKey}
      onSelectFeed={options?.onSelectFeed ?? vi.fn()}
      onListScrollTopChange={options?.onListScrollTopChange}
      onSearchQueryChange={vi.fn()}
      onToggleGroup={vi.fn()}
    />,
  );
}

describe("SubscriptionsListPane", () => {
  it("names the list pane region from its visible heading", () => {
    renderListPane([
      {
        feed: buildFeed({ title: "Named Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        status: { tone: "neutral", labelKey: "normal" },
        reasonTooltipKey: null,
      },
    ]);

    expect(screen.getByRole("region", { name: "全購読" })).toBeInTheDocument();
  });

  it("keeps the search input and clear control on the shared touch target contract", async () => {
    const user = userEvent.setup();
    const onSearchQueryChange = vi.fn();
    const row = {
      feed: buildFeed({ title: "Searchable Feed" }),
      folderId: null,
      folderName: null,
      latestArticleAt: null,
      status: { tone: "neutral", labelKey: "normal" },
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
        formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
        isGroupExpanded={() => true}
        onSelectFeed={vi.fn()}
        onSearchQueryChange={onSearchQueryChange}
        onToggleGroup={vi.fn()}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "購読を検索" })).toHaveClass("h-11", "pl-10", "pr-12");
    expect(screen.getByRole("button", { name: "検索をクリア" })).toHaveClass("size-11");

    await user.click(screen.getByRole("button", { name: "検索をクリア" }));

    expect(onSearchQueryChange).toHaveBeenCalledWith("");
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
        formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
        isGroupExpanded={() => true}
        onSelectFeed={vi.fn()}
        onSearchQueryChange={onSearchQueryChange}
        onToggleGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("一致する購読はありません。")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "検索をクリア" })[1]).toHaveClass("min-h-11");

    await user.click(screen.getAllByRole("button", { name: "検索をクリア" })[1]);

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
        status: { tone: "neutral", labelKey: "normal" },
        reasonTooltipKey: "no_articles",
      },
    ]);

    const row = screen.getByRole("button", { name: /No Article Feed/ });
    expect(row).toHaveAccessibleName(/対応不要/);
    expect(row).toHaveAccessibleName(/取得記事なし/);

    await user.hover(row);

    expect(await screen.findByText("記事がまだ取れていないため、見直し候補にはしていません")).toHaveClass(
      "motion-popup-surface",
    );
  });

  it("shows the active review reason on keyboard focus", async () => {
    const user = userEvent.setup();

    renderListPane([
      {
        feed: buildFeed({ title: "Quiet Feed" }),
        folderId: null,
        folderName: null,
        latestArticleAt: "2025-01-01T00:00:00Z",
        status: { tone: "medium", labelKey: "quiet_no_unread" },
        reasonTooltipKey: "quiet_no_unread",
      },
    ]);

    await user.tab();
    await user.tab();
    await user.tab();

    expect(await screen.findByText("更新停止が続いていて、未読もありません")).toHaveClass("motion-popup-surface");
  });

  it("renders folder disclosure rows as a tree section with count and rail", () => {
    renderListPane([
      {
        feed: buildFeed({ title: "Tree Feed", unread_count: 2 }),
        folderId: null,
        folderName: null,
        latestArticleAt: "2026-05-07T00:00:00Z",
        status: { tone: "neutral", labelKey: "normal" },
        reasonTooltipKey: null,
      },
    ]);

    const folderButton = screen.getByTestId("subscriptions-folder-row-ungrouped");
    expect(folderButton).toHaveAttribute("aria-expanded", "true");
    expect(folderButton).toHaveAttribute("aria-controls", "subscriptions-group-panel-__ungrouped__");
    expect(folderButton).toHaveClass("min-h-11");
    expect(folderButton).toHaveClass("border", "border-transparent");
    expect(folderButton).toHaveTextContent("1");

    const rail = screen.getByTestId("subscriptions-folder-tree-rail-ungrouped");
    expect(rail).toHaveClass("before:bg-[color:var(--subscriptions-list-tree-rail)]");
    expect(rail).toHaveClass("pl-5");
  });

  it("keeps collapsed folder panels hidden and inert", () => {
    renderListPane(
      [
        {
          feed: buildFeed({ title: "Collapsed Feed" }),
          folderId: null,
          folderName: null,
          latestArticleAt: null,
          status: { tone: "neutral", labelKey: "normal" },
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
        status: { tone: "neutral", labelKey: "normal" },
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
          formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
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
          formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
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
            status: { tone: "neutral", labelKey: "normal" },
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
            status: { tone: "neutral", labelKey: "normal" },
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
        status: { tone: "neutral", labelKey: "normal" },
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
          formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
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
        status: { tone: "neutral", labelKey: "normal" },
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
          formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
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
      status: { tone: "neutral", labelKey: "normal" },
      reasonTooltipKey: null,
    } satisfies SubscriptionListRow;
    const secondRow = {
      feed: buildFeed({ id: "feed-2", title: "Beta Feed", folder_id: "folder-b" }),
      folderId: "folder-b",
      folderName: "Same Folder",
      latestArticleAt: null,
      status: { tone: "neutral", labelKey: "normal" },
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
    expect(screen.getByTestId("subscriptions-folder-tree-rail-folder-a")).toBeInTheDocument();
    expect(screen.getByTestId("subscriptions-folder-tree-rail-folder-b")).toBeInTheDocument();
  });
});
