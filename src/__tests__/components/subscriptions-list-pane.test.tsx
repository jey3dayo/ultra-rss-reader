import { render, screen } from "@testing-library/react";
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
  no_unread: "見直し候補",
  no_stars: "見直し候補",
} satisfies Record<SubscriptionListRow["status"]["labelKey"], string>;

const reasonTooltipLabels = {
  no_articles: "記事がまだ取れていないため、見直し候補にはしていません",
  normal: "最近も動きがあります。今はそのままでよさそうです。",
  review: "見直しの判断材料があります",
  stale_90d: "最後に取得した記事から90日以上たっています",
  no_unread: "取得済みの記事に未読がありません",
  no_stars: "取得済みの記事にスターがありません",
} satisfies Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>;

function renderListPane(
  rows: SubscriptionListRow[],
  options?: {
    groups?: SubscriptionListGroup[];
    initialScrollTop?: number;
    isGroupExpanded?: (groupKey: string) => boolean;
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
      statusLabels={statusLabels}
      reasonTooltipLabels={reasonTooltipLabels}
      formatUnreadCountLabel={(count) => `未読 ${count}件`}
      formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
      isGroupExpanded={options?.isGroupExpanded ?? (() => true)}
      initialScrollTop={options?.initialScrollTop}
      onSelectFeed={vi.fn()}
      onToggleGroup={vi.fn()}
    />,
  );
}

describe("SubscriptionsListPane", () => {
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
        status: { tone: "medium", labelKey: "no_unread" },
        reasonTooltipKey: "no_unread",
      },
    ]);

    await user.tab();
    await user.tab();

    expect(await screen.findByText("取得済みの記事に未読がありません")).toHaveClass("motion-popup-surface");
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
    expect(folderButton).not.toHaveClass("border");
    expect(folderButton).toHaveTextContent("1");

    const rail = screen.getByTestId("subscriptions-folder-tree-rail-ungrouped");
    expect(rail).toHaveClass("border-l");
    expect(rail).toHaveClass("pl-3");
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
          statusLabels={statusLabels}
          reasonTooltipLabels={reasonTooltipLabels}
          formatUnreadCountLabel={(count) => `未読 ${count}件`}
          formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
          isGroupExpanded={() => true}
          initialScrollTop={42}
          onSelectFeed={vi.fn()}
          onToggleGroup={vi.fn()}
        />,
      );

      rerender(
        <SubscriptionsListPane
          heading="全購読"
          groups={[{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows: [row] }]}
          selectedFeedId={row.feed.id}
          emptyLabel="一致する購読はありません。"
          statusLabels={statusLabels}
          reasonTooltipLabels={reasonTooltipLabels}
          formatUnreadCountLabel={(count) => `未読 ${count}件`}
          formatLatestArticleLabel={(value) => (value ? `最終更新 ${value}` : "取得記事なし")}
          isGroupExpanded={() => true}
          initialScrollTop={84}
          onSelectFeed={vi.fn()}
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
