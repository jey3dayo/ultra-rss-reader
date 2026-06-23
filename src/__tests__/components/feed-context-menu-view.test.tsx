import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedContextMenuView } from "@/components/reader/feed-context-menu-view";
import type { FeedTreeFeedViewModel } from "@/components/reader/feed-tree.types";
import { FeedTreeRow } from "@/components/reader/feed-tree-row";
import { ContextMenu } from "@/design-system";

const baseFeed: FeedTreeFeedViewModel = {
  id: "feed-1",
  accountId: "acc-1",
  folderId: null,
  title: "Tech Blog",
  url: "https://example.com/feed.xml",
  siteUrl: "https://example.com",
  unreadCount: 3,
  readerMode: "on",
  webPreviewMode: "off",
  isSelected: false,
  grayscaleFavicon: false,
};

describe("FeedContextMenuView", () => {
  it("renders feed actions and delegates clicks", async () => {
    const onOpenSite = vi.fn();
    const onMarkAllRead = vi.fn();
    const onMarkOldUnreadRead = vi.fn();
    const onSetDisplayPreset = vi.fn();
    const onUnsubscribe = vi.fn();
    const onEdit = vi.fn();

    render(
      <ContextMenu.Root open>
        <FeedContextMenuView
          openSiteLabel="Open site"
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset="default"
          unsubscribeLabel="Unsubscribe…"
          editLabel="Edit…"
          onOpenSite={onOpenSite}
          onMarkAllRead={onMarkAllRead}
          onMarkOldUnreadRead={onMarkOldUnreadRead}
          onSetDisplayPreset={onSetDisplayPreset}
          onUnsubscribe={onUnsubscribe}
          onEdit={onEdit}
        />
      </ContextMenu.Root>,
    );

    expect(screen.getByRole("menuitem", { name: "Edit…" }).closest("[data-side]")).toHaveClass(
      "motion-popup-surface",
      "bg-surface-2/96",
      "shadow-elevation-3",
    );
    expect(screen.getByRole("menuitem", { name: "Open site" })).toHaveClass("data-highlighted:bg-surface-1/72");
    expect(screen.getByText("Display mode")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("menuitem", { name: "Unsubscribe…" })).toHaveClass(
      "text-state-danger-foreground",
      "data-highlighted:bg-state-danger-surface",
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Open site" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark all as read" }));
    expect(screen.getByText("Display mode")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Standard" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Preview" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Unsubscribe…" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit…" }));

    expect(screen.getByRole("menuitem", { name: "Edit…" })).toHaveAttribute("data-action-id", "feed-edit");
    expect(screen.getByRole("menuitem", { name: "Open site" })).toHaveAttribute("data-action-id", "feed-open-site");
    expect(screen.getByRole("menuitem", { name: "Mark all as read" })).toHaveAttribute(
      "data-action-id",
      "feed-mark-all-read",
    );
    expect(screen.getByRole("menuitem", { name: "Mark old unread as read" })).toHaveAttribute(
      "data-action-id",
      "feed-mark-old-unread-read",
    );
    expect(screen.getByRole("menuitemradio", { name: "Default" })).toBeChecked();
    expect(screen.getByRole("menuitemradio", { name: "Standard" })).not.toBeChecked();
    expect(screen.getByRole("menuitemradio", { name: "Preview" })).not.toBeChecked();
    expect(screen.getByRole("menuitemradio", { name: "Standard" })).toHaveAttribute(
      "data-action-id",
      "feed-set-display-preset",
    );
    expect(screen.getByRole("menuitemradio", { name: "Standard" })).toHaveAttribute("data-action-value", "standard");
    expect(screen.getByRole("menuitem", { name: "Unsubscribe…" })).toHaveAttribute(
      "data-action-id",
      "feed-unsubscribe",
    );
    expect(onOpenSite).toHaveBeenCalledTimes(1);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onSetDisplayPreset).toHaveBeenCalledWith("standard");
    expect(onSetDisplayPreset).toHaveBeenCalledWith("preview");
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("maps old unread preset actions to feed action ids and values", async () => {
    const user = userEvent.setup();
    const onMarkOldUnreadRead = vi.fn();

    render(
      <ContextMenu.Root open>
        <FeedContextMenuView
          openSiteLabel="Open site"
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset="default"
          unsubscribeLabel="Unsubscribe…"
          editLabel="Edit…"
          onOpenSite={vi.fn()}
          onMarkAllRead={vi.fn()}
          onMarkOldUnreadRead={onMarkOldUnreadRead}
          onSetDisplayPreset={vi.fn()}
          onUnsubscribe={vi.fn()}
          onEdit={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    await user.hover(screen.getByRole("menuitem", { name: "Mark old unread as read" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "30 days" }));

    expect(screen.getByRole("menuitem", { name: "30 days" })).toHaveAttribute(
      "data-action-id",
      "feed-mark-old-unread-read-days",
    );
    expect(screen.getByRole("menuitem", { name: "30 days" })).toHaveAttribute("data-action-value", "30");
    expect(onMarkOldUnreadRead).toHaveBeenCalledWith(30);
  });

  it("places edit first and keeps unsubscribe as the last destructive action", () => {
    render(
      <ContextMenu.Root open>
        <FeedContextMenuView
          openSiteLabel="Open site"
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset="default"
          unsubscribeLabel="Unsubscribe…"
          editLabel="Edit…"
          onOpenSite={vi.fn()}
          onMarkAllRead={vi.fn()}
          onMarkOldUnreadRead={vi.fn()}
          onSetDisplayPreset={vi.fn()}
          onUnsubscribe={vi.fn()}
          onEdit={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    const actionItems = screen.getAllByRole("menuitem").map((item) => item.textContent?.trim());
    const displayModeItems = screen.getAllByRole("menuitemradio").map((item) => item.textContent?.trim());

    expect(actionItems).toEqual(["Edit…", "Open site", "Mark all as read", "Mark old unread as read", "Unsubscribe…"]);
    expect(displayModeItems).toEqual(["✓Default", "Standard", "Preview"]);
  });

  it("hides mark all read when the feed has no unread articles", () => {
    const onMarkAllRead = vi.fn();

    render(
      <ContextMenu.Root open>
        <FeedContextMenuView
          openSiteLabel="Open site"
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset="default"
          hasUnreadArticles={false}
          unsubscribeLabel="Unsubscribe…"
          editLabel="Edit…"
          onOpenSite={vi.fn()}
          onMarkAllRead={onMarkAllRead}
          onMarkOldUnreadRead={vi.fn()}
          onSetDisplayPreset={vi.fn()}
          onUnsubscribe={vi.fn()}
          onEdit={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });

  it("captures the feed target for keyboard context menu invocation", () => {
    const renderFeedContextMenu = vi.fn((feed: FeedTreeFeedViewModel) => (
      <div data-testid="feed-context-target">{feed.title}</div>
    ));

    const { rerender } = render(
      <FeedTreeRow
        feed={baseFeed}
        displayFavicons={false}
        onSelectFeed={vi.fn()}
        renderFeedContextMenu={renderFeedContextMenu}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /Tech Blog/ }), {
      key: "ContextMenu",
    });

    rerender(
      <FeedTreeRow
        feed={{ ...baseFeed, title: "Renamed feed" }}
        displayFavicons={false}
        onSelectFeed={vi.fn()}
        renderFeedContextMenu={renderFeedContextMenu}
      />,
    );

    expect(screen.getByTestId("feed-context-target")).toHaveTextContent("Tech Blog");
  });

  it("captures the feed target for Shift+F10 context menu invocation", () => {
    const renderFeedContextMenu = vi.fn((feed: FeedTreeFeedViewModel) => (
      <div data-testid="feed-context-target">{feed.title}</div>
    ));

    const { rerender } = render(
      <FeedTreeRow
        feed={baseFeed}
        displayFavicons={false}
        onSelectFeed={vi.fn()}
        renderFeedContextMenu={renderFeedContextMenu}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /Tech Blog/ }), {
      key: "F10",
      shiftKey: true,
    });

    rerender(
      <FeedTreeRow
        feed={{ ...baseFeed, title: "Renamed feed" }}
        displayFavicons={false}
        onSelectFeed={vi.fn()}
        renderFeedContextMenu={renderFeedContextMenu}
      />,
    );

    expect(screen.getByTestId("feed-context-target")).toHaveTextContent("Tech Blog");
  });
});
