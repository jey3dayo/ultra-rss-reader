import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagSectionContextMenuView } from "@/components/reader/tag-section-context-menu-view";

describe("TagSectionContextMenuView", () => {
  it("renders tag section actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onAddTag = vi.fn();
    const onManageTags = vi.fn();

    render(
      <ContextMenu.Root open>
        <TagSectionContextMenuView
          addTagLabel="Add tag"
          manageTagsLabel="Manage tags"
          onAddTag={onAddTag}
          onManageTags={onManageTags}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Add tag" }));
    await user.click(screen.getByRole("menuitem", { name: "Manage tags" }));

    expect(onAddTag).toHaveBeenCalledTimes(1);
    expect(onManageTags).toHaveBeenCalledTimes(1);
  });
});
