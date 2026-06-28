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
    expect(screen.getByRole("heading", { level: 3, name: "Example Feed" })).toHaveClass("leading-none");
    expect(screen.getByRole("heading", { level: 3, name: "Example Feed" }).parentElement).toHaveClass(
      "items-center",
      "min-h-10",
    );
    expect(screen.getByTestId("feed-detail-status")).toHaveClass("rounded-md");
    expect(screen.getByTestId("feed-detail-status")).not.toHaveClass("self-start", "mt-0.5");
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
    expect(screen.getByText("未読 0件 / スター 0件")).toHaveClass("font-sans", "text-current");
    expect(screen.getByText("フォルダ").closest("dt")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Work").closest("dd")).toHaveClass("text-foreground");
    expect(screen.getByText("フォルダ").closest("dl")).toHaveClass("border-t", "border-border/55", "pt-3");
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "https://example.com/help");
    expect(screen.getByRole("link", { name: "Help" })).toHaveClass("text-foreground-soft");
    expect(screen.getByTestId("feed-detail-recent-articles")).toHaveClass("space-y-2", "border-t", "pt-3");
    expect(screen.getByText("最近の記事タイトル")).toHaveClass("text-[0.88rem]", "leading-5");
    expect(screen.getByTestId("feed-detail-primary-action").parentElement).toHaveClass("items-center", "min-h-10");
    expect(screen.queryByTestId("feed-detail-action-bar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "フィードを編集" })).toHaveClass(
      "size-8",
      "border-transparent",
      "bg-transparent",
      "p-0",
      "text-foreground-soft",
    );
    expect(screen.getByRole("button", { name: "フィードを編集" })).toHaveAttribute("title", "フィードを編集");
    expect(screen.getByRole("button", { name: "フィードを編集" })).not.toHaveClass("rounded-full");
  });

  it("keeps low-wire reason copy and recent articles visually quiet", () => {
    render(
      <FeedDetailPanel
        surface="low-wire"
        title="Example Feed"
        summaryText="最近も動きがあります。"
        reasonBox={{
          title: "見直しの判断材料",
          body: "今はそのままでよさそうです。",
          tone: "low",
        }}
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[
          {
            id: "art-1",
            title: "最近の記事タイトル",
            publishedAt: "2026/04/17",
            url: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("最近も動きがあります。")).toHaveClass("font-sans", "text-sm");
    expect(screen.getByText("今はそのままでよさそうです。")).toHaveClass("font-sans");
    expect(screen.getByTestId("feed-detail-recent-articles")).toHaveClass("space-y-2", "pt-1");
    expect(screen.getByTestId("feed-detail-recent-articles")).not.toHaveClass("border-t");
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

  it("keeps title links centered with their external-link icon", () => {
    render(
      <FeedDetailPanel
        title="Example Feed"
        titleHref="https://example.com"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
      />,
    );

    const titleLink = screen.getByRole("link", { name: "Example Feed" });
    expect(titleLink).toHaveClass("items-center");
    expect(screen.getByRole("heading", { level: 3, name: "Example Feed" })).toHaveClass("leading-none");
    expect(titleLink.querySelector(".lucide-external-link")).not.toHaveClass("mt-0.5");
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

  it("can omit the default metrics top divider inside passive reader summaries", () => {
    render(
      <FeedDetailPanel
        title="Example Feed"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
        showMetricsTopDivider={false}
      />,
    );

    const metricsList = screen.getByText("フォルダ").closest("dl");
    expect(metricsList).not.toHaveClass("border-t");
    expect(metricsList).toHaveClass("pt-1");
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

  it("keeps low-wire metrics in one unbroken grouped surface", () => {
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
    const panel = metricsList?.closest("[data-feed-detail-panel]");
    expect(metricsList).toHaveClass(
      "overflow-hidden",
      "gap-px",
      "rounded-md",
      "border",
      "border-[var(--workspace-low-wire-divider)]",
      "bg-[var(--workspace-low-wire-divider)]",
    );
    expect(metricsList).not.toHaveClass("border-y", "[&>*:nth-child(odd):not(:last-child)]:sm:border-r");
    expect(panel).toHaveClass("px-0", "py-0", "sm:px-0", "sm:py-0");
    expect(panel?.children[1]).toHaveClass("px-4");
    expect(screen.getByText("既定の表示").closest("div")).toHaveClass("bg-[var(--workspace-low-wire-group-surface)]");
  });

  it("applies semantic accents only to low-wire panels", () => {
    render(
      <FeedDetailPanel
        surface="low-wire"
        accentTone="unread"
        title="Unread"
        leadingVisual={<span>U</span>}
        metrics={[{ label: "記事", value: "24" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
      />,
    );

    const panel = screen.getByRole("heading", { level: 3, name: "Unread" }).closest('[data-surface-card="section"]');
    expect(panel).toHaveAttribute("data-feed-detail-accent", "unread");
    expect(panel).toHaveClass("feed-detail-accent-unread", "bg-[var(--feed-detail-accent-unread-panel-surface)]");
    expect(screen.getByTestId("feed-detail-leading-visual")).toHaveClass(
      "bg-[var(--feed-detail-accent-unread-visual-surface)]",
      "text-[var(--feed-detail-accent-unread-visual-foreground)]",
    );
    expect(screen.getByText("記事").closest("div")).toHaveClass("bg-[var(--feed-detail-accent-unread-row-surface)]");
  });

  it("keeps semantic accents from changing the default card surface", () => {
    render(
      <FeedDetailPanel
        accentTone="unread"
        title="Example Feed"
        leadingVisual={<span>EF</span>}
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[]}
      />,
    );

    const panel = screen
      .getByRole("heading", { level: 3, name: "Example Feed" })
      .closest('[data-surface-card="section"]');
    expect(panel).toHaveClass("border-border/65", "bg-card/38");
    expect(panel).not.toHaveAttribute("data-feed-detail-accent");
    expect(panel).not.toHaveClass("feed-detail-accent-unread", "bg-[var(--feed-detail-accent-unread-panel-surface)]");
    expect(screen.getByTestId("feed-detail-leading-visual")).toHaveClass("bg-surface-1/88");
    expect(screen.getByTestId("feed-detail-leading-visual")).not.toHaveClass(
      "bg-[var(--feed-detail-accent-unread-visual-surface)]",
    );
  });

  it("lets low-wire recent article dates sit below the title", () => {
    render(
      <FeedDetailPanel
        surface="low-wire"
        title="Example Feed"
        metrics={[{ label: "フォルダ", value: "Work" }]}
        recentArticlesHeading="最近の記事"
        recentArticles={[
          {
            id: "art-1",
            title: "最近の記事タイトル",
            publishedAt: "2026/04/17",
            url: "https://example.com/article",
          },
        ]}
      />,
    );

    const articleCard = screen.getByText("最近の記事タイトル").closest('[data-surface-card="info"]');
    expect(articleCard).toHaveClass(
      "rounded-md",
      "border",
      "border-[var(--workspace-low-wire-section-border)]",
      "bg-[var(--workspace-low-wire-group-surface)]",
    );
    expect(screen.getByText("2026/04/17")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("2026/04/17")).not.toHaveClass("shrink-0");
    expect(screen.getByText("2026/04/17").parentElement).toHaveClass("space-y-1");
  });

  it("keeps primary low-wire actions in the header without adding footer whitespace", () => {
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

    expect(screen.queryByTestId("feed-detail-action-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-detail-primary-action")).toHaveClass(
      "size-8",
      "bg-transparent",
      "text-foreground-soft",
    );
  });
});
