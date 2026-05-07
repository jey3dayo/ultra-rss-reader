import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import type {
  SubscriptionListGroup,
  SubscriptionListRow,
} from "@/components/subscriptions-index/subscriptions-index.types";
import { SubscriptionsListPane } from "@/components/subscriptions-index/subscriptions-list-pane";

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

function renderListPane(rows: SubscriptionListRow[]) {
  const groups: SubscriptionListGroup[] = [{ key: "__ungrouped__", label: "フォルダなし", folderId: null, rows }];

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
      isGroupExpanded={() => true}
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
});
