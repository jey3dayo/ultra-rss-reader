import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Display mode")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Preview" })).toHaveTextContent("✓Preview");
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
});
