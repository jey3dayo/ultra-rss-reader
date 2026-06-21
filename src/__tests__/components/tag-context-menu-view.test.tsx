import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagContextMenuView } from "@/components/reader/tag-context-menu-view";
import { ContextMenu } from "@/design-system";

describe("TagContextMenuView", () => {
  it("renders menu items and delegates actions", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    render(
      <ContextMenu.Root open>
        <TagContextMenuView onRename={onRename} onDelete={onDelete} />
      </ContextMenu.Root>,
    );

    expect(screen.getByRole("menuitem", { name: "Delete…" })).toHaveClass(
      "text-state-danger-foreground",
      "data-highlighted:bg-state-danger-surface",
    );
    expect(screen.getByRole("menuitem", { name: "Edit…" })).toHaveAttribute("data-action-id", "tag-edit");
    expect(screen.getByRole("menuitem", { name: "Delete…" })).toHaveAttribute("data-action-id", "tag-delete");

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete…" }));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
