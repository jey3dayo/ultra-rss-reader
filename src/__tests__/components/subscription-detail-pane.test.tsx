import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { SubscriptionDetailPane } from "@/components/subscriptions-index/subscription-detail-pane";
import { WorkspaceManagementActionButton } from "@/design-system";
import type { SubscriptionDetailMetrics, SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

function buildFeed(overrides: Partial<FeedDto> = {}): FeedDto {
  return {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Example Feed",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 3,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    ...overrides,
    icon_url: overrides.icon_url ?? null,
  };
}

function buildRow(): SubscriptionListRow {
  return {
    feed: buildFeed(),
    folderId: null,
    folderName: null,
    latestArticleAt: null,
    recentArticleCount: 0,
    status: { tone: "neutral", labelKey: "normal" },
    reasonTooltipKey: null,
  };
}

const metrics: SubscriptionDetailMetrics = {
  latestArticleAt: null,
  starredCount: 0,
  recentArticleCount: 0,
  previewArticles: [],
};

const baseProps = {
  heading: "Details",
  emptyLabel: "Select a subscription",
  row: buildRow(),
  metrics,
  detailCandidate: null,
  folderLabel: "Folder",
  latestArticleLabel: "Latest",
  latestArticleEmptyLabel: "No updates yet",
  updateFrequencyLabel: "Update frequency",
  formatUpdateFrequencyValue: (recentArticleCount: number) => `${recentArticleCount} recent`,
  unreadCountLabel: "Unread",
  starredCountLabel: "Starred",
  reasonHeading: "Reason",
  reasonHint: "No review needed",
  recentArticlesHeading: "Recent articles",
  feedUrlLabel: "Open RSS feed",
  contentUrlLabel: "Content URL",
  displayModeLabel: "Display",
  displayModeValue: "Default",
  decisionActions: null,
  managementActions: null,
  dateLocale: "en",
};

function getLatestArticleMetricRow(): HTMLElement {
  const row = screen.getByText("Latest").closest("div");
  expect(row).not.toBeNull();
  if (!row) {
    throw new Error("Expected latest article metric row");
  }
  return row;
}

describe("SubscriptionDetailPane", () => {
  it("names the detail pane region via an accessible label", () => {
    render(<SubscriptionDetailPane {...baseProps} />);

    expect(screen.getByRole("region", { name: "Details" })).toBeInTheDocument();
  });

  it("shows fetch failure context and retry and diagnostic actions", () => {
    const onRetryFeed = vi.fn();
    const onCopyDiagnosticId = vi.fn();
    const onEditFeed = vi.fn();
    render(
      <SubscriptionDetailPane
        {...baseProps}
        fetchError={{
          feed_id: "feed-1",
          last_attempt_at: "2026-04-04T12:00:00Z",
          last_success_at: null,
          error_kind: "private_address_blocked",
          error_count: 1,
          diagnostic_id: "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1",
        }}
        fetchErrorLabels={{
          heading: "Fetch error",
          lastAttempt: "Last failed",
          copyDiagnosticId: "Copy diagnostic number",
          retry: "Retry",
          retrying: "Retrying",
          editFeedUrl: "Review feed destination",
          reason: () => "Access to a local address was blocked.",
        }}
        onRetryFeed={onRetryFeed}
        onCopyDiagnosticId={onCopyDiagnosticId}
        onEditFeed={onEditFeed}
      />,
    );

    expect(screen.getByTestId("subscriptions-fetch-error-detail")).toHaveTextContent(
      "Access to a local address was blocked.",
    );
    expect(screen.getByText(/Last failed: Apr 4, \d{2}:\d{2}/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy diagnostic number" }));
    fireEvent.click(screen.getByRole("button", { name: "Review feed destination" }));

    expect(onRetryFeed).toHaveBeenCalledWith("feed-1");
    expect(onCopyDiagnosticId).toHaveBeenCalledWith("b52e8e15-b8c0-46d3-9949-44a6e5aab0b1");
    expect(onEditFeed).toHaveBeenCalledOnce();
  });

  it("omits an invalid last-attempt timestamp instead of rendering it as raw text", () => {
    render(
      <SubscriptionDetailPane
        {...baseProps}
        fetchError={{
          feed_id: "feed-1",
          last_attempt_at: "not-a-timestamp",
          last_success_at: null,
          error_kind: "network",
          error_count: 1,
          diagnostic_id: null,
        }}
        fetchErrorLabels={{
          heading: "Fetch error",
          lastAttempt: "Last failed",
          copyDiagnosticId: "Copy diagnostic number",
          retry: "Retry",
          retrying: "Retrying",
          editFeedUrl: "Review feed destination",
          reason: () => "Communication failed.",
        }}
      />,
    );

    expect(screen.queryByText(/Last failed:/)).not.toBeInTheDocument();
    expect(screen.queryByText("not-a-timestamp")).not.toBeInTheDocument();
  });

  it("replaces healthy detail status when a normal feed has a fetch error", () => {
    render(
      <SubscriptionDetailPane
        {...baseProps}
        detailCandidate={{
          candidate: null,
          tone: "neutral",
          statusLabel: "対応不要",
          summary: "最近も動きがあります。今はそのままでよさそうです。",
          reasonBoxBody: "最近も動きがあります。今はそのままでよさそうです。",
          reasonLabels: ["最近も更新"],
        }}
        fetchError={{
          feed_id: "feed-1",
          last_attempt_at: "2026-04-04T12:00:00Z",
          last_success_at: null,
          error_kind: "network",
          error_count: 1,
          diagnostic_id: null,
        }}
        fetchErrorLabels={{
          heading: "取得エラー",
          lastAttempt: "失敗日時",
          copyDiagnosticId: "診断番号をコピー",
          retry: "再取得",
          retrying: "再取得中",
          editFeedUrl: "取得先を確認",
          reason: () => "通信に失敗しました。",
        }}
      />,
    );

    expect(screen.getByTestId("feed-detail-status")).toHaveTextContent("取得エラー");
    expect(screen.getByTestId("feed-detail-status")).toHaveAttribute("data-label-chip", "danger");
    expect(screen.queryByText("対応不要")).not.toBeInTheDocument();
    expect(screen.queryByText("最近も動きがあります。今はそのままでよさそうです。")).not.toBeInTheDocument();
    expect(screen.queryByText("最近も更新")).not.toBeInTheDocument();
  });

  it("does not treat a healthy status DTO as a fetch failure", () => {
    render(
      <SubscriptionDetailPane
        {...baseProps}
        detailCandidate={{
          candidate: null,
          tone: "neutral",
          statusLabel: "対応不要",
          summary: "最近も動きがあります。今はそのままでよさそうです。",
          reasonBoxBody: "最近も動きがあります。今はそのままでよさそうです。",
          reasonLabels: [],
        }}
        fetchError={{
          feed_id: "feed-1",
          last_attempt_at: "2026-04-04T12:00:00Z",
          last_success_at: "2026-04-04T12:00:00Z",
          error_kind: null,
          error_count: 0,
          diagnostic_id: null,
        }}
        fetchErrorLabels={{
          heading: "取得エラー",
          lastAttempt: "失敗日時",
          copyDiagnosticId: "診断番号をコピー",
          retry: "再取得",
          retrying: "再取得中",
          editFeedUrl: "取得先を確認",
          reason: () => "通信に失敗しました。",
        }}
      />,
    );

    expect(screen.getByTestId("feed-detail-status")).toHaveTextContent("対応不要");
    expect(screen.getByText("最近も動きがあります。今はそのままでよさそうです。")).toBeInTheDocument();
    expect(screen.queryByTestId("subscriptions-fetch-error-detail")).not.toBeInTheDocument();
  });

  it("retains stale review context alongside an independent fetch error", () => {
    render(
      <SubscriptionDetailPane
        {...baseProps}
        row={{ ...buildRow(), status: { tone: "medium", labelKey: "stale_90d" } }}
        detailCandidate={{
          candidate: null,
          tone: "medium",
          statusLabel: "90日以上未更新",
          summary: "更新が止まっています。",
          reasonBoxBody: "最終更新から120日です。",
          reasonLabels: ["90日以上"],
        }}
        fetchError={{
          feed_id: "feed-1",
          last_attempt_at: "2026-04-04T12:00:00Z",
          last_success_at: null,
          error_kind: "network",
          error_count: 1,
          diagnostic_id: null,
        }}
        fetchErrorLabels={{
          heading: "取得エラー",
          lastAttempt: "失敗日時",
          copyDiagnosticId: "診断番号をコピー",
          retry: "再取得",
          retrying: "再取得中",
          editFeedUrl: "取得先を確認",
          reason: () => "通信に失敗しました。",
        }}
      />,
    );

    expect(screen.getByTestId("feed-detail-status")).toHaveTextContent("取得エラー");
    expect(screen.getByText("最終更新から120日です。")).toBeInTheDocument();
    expect(screen.getByText("通信に失敗しました。")).toBeInTheDocument();
  });

  it("disables a feed retry while its request is in flight", () => {
    render(
      <SubscriptionDetailPane
        {...baseProps}
        fetchError={{
          feed_id: "feed-1",
          last_attempt_at: "2026-04-04T12:00:00Z",
          last_success_at: null,
          error_kind: "network",
          error_count: 1,
          diagnostic_id: null,
        }}
        fetchErrorLabels={{
          heading: "Fetch error",
          lastAttempt: "Last failed",
          copyDiagnosticId: "Copy diagnostic number",
          retry: "Retry",
          retrying: "Retrying",
          editFeedUrl: "Edit feed URL",
          reason: () => "The request failed.",
        }}
        isRetryingFeed={() => true}
      />,
    );

    expect(screen.getByRole("button", { name: "Retrying" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retrying" })).toHaveAttribute("aria-busy", "true");
  });

  it("places the RSS and content links between the metrics and recent articles", () => {
    render(<SubscriptionDetailPane {...baseProps} />);

    const feedLink = screen.getByRole("link", { name: "Open RSS feed" });
    const contentLink = screen.getByRole("link", { name: "Content URL" });
    const metricsList = screen.getByText("Folder").closest("dl");

    expect(feedLink).toHaveAttribute("href", "https://example.com/feed.xml");
    expect(feedLink).toHaveAttribute("target", "_blank");
    expect(contentLink).toHaveAttribute("href", "https://example.com");
    expect(contentLink).toHaveAttribute("target", "_blank");
    expect(metricsList?.nextElementSibling).toContainElement(contentLink);
    expect(contentLink.nextElementSibling).toBe(feedLink);
  });

  it("renders shared workspace management action button styles by intent", () => {
    render(
      <>
        <WorkspaceManagementActionButton intent="edit" label="Edit" onClick={vi.fn()}>
          Edit
        </WorkspaceManagementActionButton>
        <WorkspaceManagementActionButton intent="delete" label="Remove" onClick={vi.fn()}>
          Remove
        </WorkspaceManagementActionButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toHaveClass(
      "justify-center",
      "rounded-md",
      "min-h-11",
      "bg-surface-1/88",
      "text-foreground-soft",
    );
    expect(screen.getByRole("button", { name: "Remove" })).toHaveClass(
      "justify-center",
      "rounded-md",
      "min-h-11",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
  });

  it("delegates decision bar actions and hides management actions while decisions are present", () => {
    const decisionActions = {
      keepLabel: "Keep",
      deferLabel: "Later",
      deleteLabel: "Delete",
      onKeep: vi.fn(),
      onDefer: vi.fn(),
      onDelete: vi.fn(),
    };
    const managementActions = {
      editLabel: "Edit",
      deleteLabel: "Remove",
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    };

    render(
      <SubscriptionDetailPane {...baseProps} decisionActions={decisionActions} managementActions={managementActions} />,
    );

    expect(screen.getByTestId("subscriptions-detail-decision-bar")).toHaveClass("grid-cols-1", "sm:grid-cols-3");
    expect(screen.queryByTestId("subscriptions-detail-management-bar")).not.toBeInTheDocument();
    for (const label of ["Keep", "Later", "Delete"]) {
      const actionButton = screen.getByRole("button", { name: label });
      expect(actionButton).toBeVisible();
      expect(actionButton.querySelector("svg")).toHaveClass("size-4");
    }

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(decisionActions.onKeep).toHaveBeenCalledOnce();
    expect(decisionActions.onDefer).toHaveBeenCalledOnce();
    expect(decisionActions.onDelete).toHaveBeenCalledOnce();
    expect(managementActions.onEdit).not.toHaveBeenCalled();
    expect(managementActions.onDelete).not.toHaveBeenCalled();
  });

  it("delegates management actions when no decision actions are present", () => {
    const managementActions = {
      editLabel: "Edit",
      deleteLabel: "Remove",
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    };

    render(<SubscriptionDetailPane {...baseProps} decisionActions={null} managementActions={managementActions} />);

    expect(screen.queryByTestId("subscriptions-detail-decision-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("subscriptions-detail-management-bar")).toHaveClass("flex", "flex-wrap", "justify-end");
    for (const label of ["Edit", "Remove"]) {
      const actionButton = screen.getByRole("button", { name: label });
      expect(actionButton).toBeVisible();
      expect(actionButton.querySelector("svg")).toHaveClass("size-4");
    }
    expect(screen.getByRole("button", { name: "Edit" })).toHaveClass("bg-surface-1/88", "text-foreground-soft");
    expect(screen.getByRole("button", { name: "Remove" })).toHaveClass(
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(managementActions.onEdit).toHaveBeenCalledOnce();
    expect(managementActions.onDelete).toHaveBeenCalledOnce();
  });

  it("renders the localized empty label for missing and invalid latest article dates", () => {
    const { rerender } = render(
      <SubscriptionDetailPane
        {...baseProps}
        metrics={{ ...metrics, latestArticleAt: null }}
        decisionActions={null}
        managementActions={null}
      />,
    );

    expect(within(getLatestArticleMetricRow()).getByText("No updates yet")).toBeInTheDocument();
    expect(within(getLatestArticleMetricRow()).queryByText("—")).not.toBeInTheDocument();

    rerender(
      <SubscriptionDetailPane
        {...baseProps}
        metrics={{ ...metrics, latestArticleAt: "not-a-date" }}
        decisionActions={null}
        managementActions={null}
      />,
    );

    expect(within(getLatestArticleMetricRow()).getByText("No updates yet")).toBeInTheDocument();
    expect(within(getLatestArticleMetricRow()).queryByText("Invalid Date")).not.toBeInTheDocument();
    expect(within(getLatestArticleMetricRow()).queryByText("—")).not.toBeInTheDocument();
  });
});
