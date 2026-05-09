import { ContextMenu } from "@base-ui/react/context-menu";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderContextMenuView } from "@/components/reader/folder-context-menu-view";

describe("FolderContextMenuView", () => {
  it("renders folder actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = vi.fn();
    const onMarkOldUnreadRead = vi.fn();
    const onSetDisplayPreset = vi.fn();

    render(
      <ContextMenu.Root open>
        <FolderContextMenuView
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset="preview"
          onMarkAllRead={onMarkAllRead}
          onMarkOldUnreadRead={onMarkOldUnreadRead}
          onSetDisplayPreset={onSetDisplayPreset}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Mark all as read" }));
    await user.click(screen.getByRole("menuitem", { name: "Standard" }));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onSetDisplayPreset).toHaveBeenCalledWith("standard");
    expect(screen.getByRole("menuitem", { name: "Mark all as read" })).toHaveAttribute(
      "data-action-id",
      "folder-mark-all-read",
    );
    expect(screen.getByRole("menuitem", { name: "Standard" })).toHaveAttribute(
      "data-action-id",
      "folder-set-display-preset",
    );
    expect(screen.getByRole("menuitem", { name: "Standard" })).toHaveAttribute("data-action-value", "standard");
    expect(screen.getByText("Display mode")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Preview" })).toHaveTextContent("✓Preview");
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
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset="preview"
          onMarkAllRead={vi.fn()}
          onMarkOldUnreadRead={onMarkOldUnreadRead}
          onSetDisplayPreset={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    await user.hover(screen.getByRole("menuitem", { name: "Mark old unread as read" }));

    expect(await screen.findByRole("menuitem", { name: "7 days" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "30 days" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "90 days" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "30 days" }));

    expect(onMarkOldUnreadRead).toHaveBeenCalledWith(30);
  });

  it("shows no selected preset marker when folder feeds have mixed display modes", () => {
    render(
      <ContextMenu.Root open>
        <FolderContextMenuView
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset={null}
          onMarkAllRead={vi.fn()}
          onMarkOldUnreadRead={vi.fn()}
          onSetDisplayPreset={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.getByRole("menuitem", { name: "Default" })).not.toHaveTextContent("✓");
    expect(screen.getByRole("menuitem", { name: "Standard" })).not.toHaveTextContent("✓");
    expect(screen.getByRole("menuitem", { name: "Preview" })).not.toHaveTextContent("✓");
  });

  it("hides mark all read when the folder has no unread articles", () => {
    const onMarkAllRead = vi.fn();

    render(
      <ContextMenu.Root open>
        <FolderContextMenuView
          markAllReadLabel="Mark all as read"
          markOldUnreadReadLabel="Mark old unread as read"
          oldUnreadDayLabel={(days) => `${days} days`}
          displayModeLabel="Display mode"
          displayPresetOptions={[
            { value: "default", label: "Default" },
            { value: "standard", label: "Standard" },
            { value: "preview", label: "Preview" },
          ]}
          selectedDisplayPreset="preview"
          hasUnreadArticles={false}
          onMarkAllRead={onMarkAllRead}
          onMarkOldUnreadRead={vi.fn()}
          onSetDisplayPreset={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(onMarkAllRead).not.toHaveBeenCalled();
  });
});
