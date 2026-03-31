import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedContextMenuView } from "@/components/reader/feed-context-menu-view";

describe("FeedContextMenuView", () => {
  it("renders feed actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onOpenSite = vi.fn();
    const onMarkAllRead = vi.fn();
    const onUnsubscribe = vi.fn();
    const onEdit = vi.fn();

    render(
      <ContextMenu.Root open>
        <FeedContextMenuView
          openSiteLabel="Open site"
          markAllReadLabel="Mark all as read"
          unsubscribeLabel="Unsubscribe…"
          editLabel="Edit…"
          onOpenSite={onOpenSite}
          onMarkAllRead={onMarkAllRead}
          onUnsubscribe={onUnsubscribe}
          onEdit={onEdit}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Open site" }));
    await user.click(screen.getByRole("menuitem", { name: "Mark all as read" }));
    await user.click(screen.getByRole("menuitem", { name: "Unsubscribe…" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));

    expect(onOpenSite).toHaveBeenCalledTimes(1);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
