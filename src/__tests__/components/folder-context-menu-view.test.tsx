import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderContextMenuView } from "@/components/reader/folder-context-menu-view";

describe("FolderContextMenuView", () => {
  it("renders folder actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onMarkAllRead = vi.fn();

    render(
      <ContextMenu.Root open>
        <FolderContextMenuView markAllReadLabel="Mark all as read" onMarkAllRead={onMarkAllRead} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Mark all as read" }));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });
});
