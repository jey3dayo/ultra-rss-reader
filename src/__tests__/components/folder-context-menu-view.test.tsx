import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderContextMenuView } from "@/components/reader/folder-context-menu-view";
import { ContextMenu } from "@/design-system";

describe("FolderContextMenuView", () => {
  it("renders folder actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = vi.fn();
    const onMarkOldUnreadRead = vi.fn();

    render(
      <ContextMenu.Root open>
        <FolderContextMenuView
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          onMarkAllRead={onMarkAllRead}
          onMarkOldUnreadRead={onMarkOldUnreadRead}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Mark all as read" }));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menuitem", { name: "Mark all as read" })).toHaveAttribute(
      "data-action-id",
      "folder-mark-all-read",
    );
    expect(screen.getByRole("menuitem", { name: "Mark old unread as read" })).toHaveAttribute(
      "data-action-id",
      "folder-mark-old-unread-read",
    );
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    expect(screen.queryByText("Display mode")).not.toBeInTheDocument();
  });

  it("renders old unread day presets and delegates the selected day", async () => {
    const user = userEvent.setup();
    const onMarkOldUnreadRead = vi.fn();

    render(
      <ContextMenu.Root open>
        <FolderContextMenuView
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          onMarkAllRead={vi.fn()}
          onMarkOldUnreadRead={onMarkOldUnreadRead}
        />
      </ContextMenu.Root>,
    );

    await user.hover(screen.getByRole("menuitem", { name: "Mark old unread as read" }));

    expect(await screen.findByRole("menuitem", { name: "7 days" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "30 days" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "90 days" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "30 days" }));

    expect(screen.getByRole("menuitem", { name: "30 days" })).toHaveAttribute(
      "data-action-id",
      "folder-mark-old-unread-read-days",
    );
    expect(screen.getByRole("menuitem", { name: "30 days" })).toHaveAttribute("data-action-value", "30");
    expect(onMarkOldUnreadRead).toHaveBeenCalledWith(30);
  });

  it("hides mark all read when the folder has no unread articles", () => {
    const onMarkAllRead = vi.fn();

    render(
      <ContextMenu.Root open>
        <FolderContextMenuView
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          hasUnreadArticles={false}
          onMarkAllRead={onMarkAllRead}
          onMarkOldUnreadRead={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });
});
