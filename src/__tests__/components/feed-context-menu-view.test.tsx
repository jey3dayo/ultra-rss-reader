import { ContextMenu } from "@base-ui/react/context-menu";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedContextMenuView } from "@/components/reader/feed-context-menu-view";

describe("FeedContextMenuView", () => {
  it("renders feed actions and delegates clicks", async () => {
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

    expect(screen.getByRole("menuitem", { name: "Edit…" }).closest("[data-side]")).toHaveClass(
      "bg-surface-2",
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
    fireEvent.click(screen.getByRole("menuitem", { name: "Standard" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Preview" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Unsubscribe…" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit…" }));

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
