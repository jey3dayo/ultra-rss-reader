import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagContextMenuView } from "@/components/reader/tag-context-menu-view";

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

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete…" }));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
