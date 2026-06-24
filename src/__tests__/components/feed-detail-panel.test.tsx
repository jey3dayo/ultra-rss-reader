import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedDetailPanel } from "@/design-system";

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
        links={[{ href: "https://example.com/help", label: "Help" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[
          {
            id: "art-1",
            title: "最近の記事タイトル",
            publishedAt: "2026/04/17",
            url: "https://example.com/article",
          },
        ]}
        primaryAction={{ label: "フィードを編集", onClick: () => {} }}
      />,
    );

    expect(screen.getByTestId("detail-leading-visual")).toBeInTheDocument();
    const panelHeader = screen
      .getByTestId("feed-detail-leading-visual")
      .closest('[data-surface-card="section"]')?.firstElementChild;
    expect(panelHeader).not.toBeNull();
    expect(panelHeader).toHaveClass("relative", "overflow-hidden", "border-b");
    expect(screen.getByTestId("feed-detail-leading-visual")).toHaveClass(
      "size-10",
      "rounded-md",
      "border",
      "bg-surface-1/88",
    );
    expect(screen.getByTestId("feed-detail-main-column").contains(screen.getByTestId("feed-detail-status"))).toBe(true);
    expect(
      screen.getByTestId("feed-detail-secondary-column").contains(screen.getByTestId("feed-detail-reason-box")),
    ).toBe(true);
    expect(screen.getByTestId("feed-detail-secondary-column")).not.toHaveClass("grid-cols-[auto_minmax(0,1fr)]");
    expect(screen.getByTestId("feed-detail-status")).toHaveClass("rounded-md", "self-start");
    expect(screen.getByTestId("feed-detail-reason-box").closest('[data-surface-card="section"]')).toHaveClass(
      "bg-card/38",
    );
    expect(screen.getByText("静かな購読です。")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("静かな購読です。").closest('[data-surface-card="info"]')).toBeNull();
    expect(screen.getByTestId("feed-detail-reason-box")).toHaveClass(
      "border-state-warning-border/80",
      "bg-state-warning-surface/80",
      "text-state-warning-foreground",
    );
    expect(screen.getByText("2026/04/17")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("整理の判断材料")).toHaveClass("text-current");
    expect(screen.getByText("未読 0件 / スター 0件")).toHaveClass("text-current");
    expect(screen.getByText("フォルダ").closest("dt")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Work").closest("dd")).toHaveClass("text-foreground");
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "https://example.com/help");
    expect(screen.getByRole("link", { name: "Help" })).toHaveClass("text-foreground-soft");
    expect(screen.getByTestId("feed-detail-recent-articles")).toHaveClass("space-y-2", "border-t", "pt-3");
    expect(screen.getByText("最近の記事タイトル")).toHaveClass("text-[0.88rem]", "leading-5");
    expect(screen.getByRole("button", { name: "フィードを編集" }).parentElement).toHaveClass("border-t", "pt-3");
    expect(screen.getByRole("button", { name: "フィードを編集" })).toHaveClass(
      "min-h-9",
      "w-auto",
      "px-3",
      "border-border/70",
      "bg-surface-1/72",
    );
    expect(screen.getByRole("button", { name: "フィードを編集" })).not.toHaveClass("rounded-full");
  });

  it("renders neutral reason chips instead of muted chips", () => {
    render(
      <FeedDetailPanel
        title="Example Feed"
        summaryText="静かな購読です。"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
        reasonChips={["整理候補", "未読 0件"]}
      />,
    );

    expect(screen.getByText("整理候補").closest("span")).toHaveAttribute("data-label-chip", "neutral");
    expect(screen.getByText("整理候補").closest("span")).toHaveClass("bg-surface-1/80");
    expect(screen.getByText("整理候補").closest("span")).toHaveClass("rounded-md");
    expect(screen.getByText("未読 0件").closest("span")).toHaveAttribute("data-label-chip", "neutral");
  });

  it("uses the feed detail link label as the displayed link text", () => {
    render(
      <FeedDetailPanel
        title="Example Feed"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        links={[{ href: "https://example.com/rss.xml", label: "公式サイト" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
      />,
    );

    expect(screen.getByRole("link", { name: "公式サイト" })).toHaveAttribute("href", "https://example.com/rss.xml");
    expect(screen.queryByText("https://example.com/rss.xml")).not.toBeInTheDocument();
  });

  it("keeps secondary actions on the shared touch target contract", () => {
    render(
      <FeedDetailPanel
        title="Example Feed"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
        secondaryAction={{ label: "後で確認", onClick: () => {} }}
      />,
    );

    expect(screen.getByRole("button", { name: "後で確認" })).toHaveClass("min-h-11", "px-4");
  });

  it("does not render invalid feed website title hrefs as links", () => {
    render(
      <FeedDetailPanel
        title="Private Feed"
        titleHref="https://user:secret@example.com/private.xml?token=hidden"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Private Feed" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Private Feed/ })).toBeNull();
    expect(screen.queryByText("https://user:secret@example.com/private.xml?token=hidden")).toBeNull();
  });

  it("allows reader shells to share the detail panel surface treatment", () => {
    render(
      <FeedDetailPanel
        title="Example Feed"
        className="rounded-3xl bg-card/38"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Example Feed" }).closest('[data-surface-card="section"]'),
    ).toHaveClass("rounded-3xl", "bg-card/38");
  });

  it("omits the low-wire right divider on a final odd metric", () => {
    render(
      <FeedDetailPanel
        surface="low-wire"
        title="Example Feed"
        metrics={[
          { label: "フォルダ", value: "Work" },
          { label: "最終記事", value: "2026/04/17" },
          { label: "未読", value: 0 },
          { label: "スター", value: 0 },
          { label: "表示", value: "既定の表示" },
        ]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
      />,
    );

    const metricsList = screen.getByText("フォルダ").closest("dl");
    expect(metricsList).toHaveClass("[&>*:nth-child(odd):not(:last-child)]:sm:border-r");
    expect(metricsList).not.toHaveClass("[&>*:nth-child(odd)]:sm:border-r");
    expect(screen.getByText("既定の表示").closest("div")).toHaveClass("last:border-b-0");
  });

  it("uses the low-wire action surface for embedded actions", () => {
    render(
      <FeedDetailPanel
        surface="low-wire"
        title="Example Feed"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
        primaryAction={{ label: "購読を管理", onClick: () => {} }}
      />,
    );

    expect(screen.getByTestId("feed-detail-action-bar")).toHaveClass(
      "border-[var(--workspace-low-wire-divider)]",
      "bg-[var(--workspace-low-wire-action-surface)]",
    );
  });
});
