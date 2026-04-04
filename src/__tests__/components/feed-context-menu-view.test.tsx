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
    const onSetDisplayPreset = vi.fn();
    const onUnsubscribe = vi.fn();
    const onEdit = vi.fn();

    render(
      <ContextMenu.Root open>
        <FeedContextMenuView
          openSiteLabel="Open site"
          markAllReadLabel="Mark all as read"
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
          onSetDisplayPreset={onSetDisplayPreset}
          onUnsubscribe={onUnsubscribe}
          onEdit={onEdit}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Open site" }));
    await user.click(screen.getByRole("menuitem", { name: "Mark all as read" }));
    expect(screen.getByText("Display mode")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Standard" }));
    await user.click(screen.getByRole("menuitem", { name: "Preview" }));
    await user.click(screen.getByRole("menuitem", { name: "Unsubscribe…" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));

    expect(onOpenSite).toHaveBeenCalledTimes(1);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onSetDisplayPreset).toHaveBeenCalledWith("standard");
    expect(onSetDisplayPreset).toHaveBeenCalledWith("preview");
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("places edit first and keeps unsubscribe as the last destructive action", () => {
    render(
      <ContextMenu.Root open>
        <FeedContextMenuView
          openSiteLabel="Open site"
          markAllReadLabel="Mark all as read"
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
          onSetDisplayPreset={vi.fn()}
          onUnsubscribe={vi.fn()}
          onEdit={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    const menuItems = screen.getAllByRole("menuitem").map((item) => item.textContent?.trim());

    expect(menuItems).toEqual([
      "Edit…",
      "Open site",
      "Mark all as read",
      "✓Default",
      "Standard",
      "Preview",
      "Unsubscribe…",
    ]);
  });
});
