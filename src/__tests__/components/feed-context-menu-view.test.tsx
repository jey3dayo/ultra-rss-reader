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
            { value: "reader_only", label: "Reader only" },
            { value: "reader_and_preview", label: "Reader + Preview" },
            { value: "preview_only", label: "Preview only" },
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
    await user.click(screen.getByRole("menuitem", { name: "Reader only" }));
    await user.click(screen.getByRole("menuitem", { name: "Reader + Preview" }));
    await user.click(screen.getByRole("menuitem", { name: "Unsubscribe…" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));

    expect(onOpenSite).toHaveBeenCalledTimes(1);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onSetDisplayPreset).toHaveBeenCalledWith("reader_only");
    expect(onSetDisplayPreset).toHaveBeenCalledWith("reader_and_preview");
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
