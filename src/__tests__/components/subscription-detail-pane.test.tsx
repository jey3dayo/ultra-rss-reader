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
  };
}

function buildRow(): SubscriptionListRow {
  return {
    feed: buildFeed(),
    folderId: null,
    folderName: null,
    latestArticleAt: null,
    status: { tone: "neutral", labelKey: "normal" },
    reasonTooltipKey: null,
  };
}

const metrics: SubscriptionDetailMetrics = {
  latestArticleAt: null,
  starredCount: 0,
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
  it("names the detail pane region from its visible heading", () => {
    render(<SubscriptionDetailPane {...baseProps} />);

    expect(screen.getByRole("region", { name: "Details" })).toBeInTheDocument();
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
    expect(metricsList?.nextElementSibling).toContainElement(feedLink);
    expect(feedLink.nextElementSibling).toBe(contentLink);
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
