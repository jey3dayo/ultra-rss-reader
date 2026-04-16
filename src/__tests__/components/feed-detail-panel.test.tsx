import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";

describe("FeedDetailPanel", () => {
  it("renders a leading visual and compact status styling", () => {
    render(
      <FeedDetailPanel
        title="Example Feed"
        badgeLabel="見直し候補"
        badgeTone="medium"
        leadingVisual={<span data-testid="detail-leading-visual">EF</span>}
        summaryText="静かな購読です。"
        reasonBox={{
          title: "整理の判断材料",
          body: "未読 0件 / スター 0件",
          tone: "medium",
        }}
        metrics={[
          { label: "フォルダ", value: "Work" },
          { label: "表示", value: "既定の表示" },
        ]}
        recentArticlesHeading="最近の記事"
        recentArticles={[
          {
            id: "art-1",
            title: "最近の記事タイトル",
            publishedAt: "2026/04/17",
            url: "https://example.com/article",
          },
        ]}
        primaryAction={{ label: "購読の整理", onClick: () => {} }}
      />,
    );

    expect(screen.getByTestId("detail-leading-visual")).toBeInTheDocument();
    expect(screen.getByTestId("feed-detail-leading-visual")).toHaveClass(
      "h-10",
      "w-10",
      "rounded-lg",
      "border",
      "bg-surface-1/88",
    );
    expect(screen.getByTestId("feed-detail-status")).toHaveClass("rounded-lg");
    expect(screen.getByTestId("feed-detail-reason-box").closest('[data-surface-card="section"]')).toHaveClass(
      "bg-card/38",
    );
    expect(screen.getByText("静かな購読です。").closest('[data-surface-card="info"]')).toHaveClass("bg-surface-1/76");
    expect(screen.getByTestId("feed-detail-reason-box")).toHaveClass(
      "border-state-warning-border/80",
      "bg-state-warning-surface/80",
      "text-state-warning-foreground",
    );
    expect(screen.getByText("静かな購読です。")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("2026/04/17")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("整理の判断材料")).toHaveClass("text-current/88");
    expect(screen.getByText("未読 0件 / スター 0件")).toHaveClass("text-current/90");
    expect(screen.getByText("フォルダ").closest("dt")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Work").closest("dd")).toHaveClass("text-foreground");
    expect(screen.getByText("最近の記事").parentElement).toHaveClass("border-t", "pt-4");
    expect(screen.getByRole("button", { name: "購読の整理" }).parentElement).toHaveClass("border-t", "pt-4");
    expect(screen.getByRole("button", { name: "購読の整理" })).not.toHaveClass("rounded-full");
  });
});
