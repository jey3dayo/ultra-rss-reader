import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagListView } from "@/components/reader/tag-list-view";
import { TagSectionContextMenuView } from "@/components/reader/tag-section-context-menu-view";

describe("TagListView", () => {
  it("opens the tag section context menu on right click without changing left-click toggle behavior", async () => {
    const onToggleOpen = vi.fn();
    const onAddTag = vi.fn();
    const onManageTags = vi.fn();

    render(
      <TagListView
        tagsLabel="Tags"
        tags={[]}
        isOpen={false}
        onToggleOpen={onToggleOpen}
        onSelectTag={vi.fn()}
        renderTagSectionContextMenu={() => (
          <TagSectionContextMenuView
            addTagLabel="Add tag"
            manageTagsLabel="Manage tags"
            onAddTag={onAddTag}
            onManageTags={onManageTags}
          />
        )}
        renderContextMenu={() => <div />}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Tags" });

    fireEvent.contextMenu(toggle);

    expect(onToggleOpen).not.toHaveBeenCalled();
    expect(await screen.findByRole("menuitem", { name: "Add tag" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Manage tags" })).toBeInTheDocument();
  });

  it("renders tag rows with counts and selects the clicked tag", async () => {
    const user = userEvent.setup();
    const onSelectTag = vi.fn();

    render(
      <TagListView
        tagsLabel="Tags"
        tags={[
          { id: "tag-1", name: "Later", color: "#3b82f6", articleCount: 2, isSelected: true },
          { id: "tag-2", name: "Work", color: null, articleCount: 0, isSelected: false },
        ]}
        isOpen={true}
        onToggleOpen={vi.fn()}
        onSelectTag={onSelectTag}
        renderTagSectionContextMenu={() => (
          <TagSectionContextMenuView
            addTagLabel="Add tag"
            manageTagsLabel="Manage tags"
            onAddTag={vi.fn()}
            onManageTags={vi.fn()}
          />
        )}
        renderContextMenu={() => <div />}
      />,
    );

    expect(screen.getByRole("button", { name: "Tags" })).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Work/ }));
    expect(onSelectTag).toHaveBeenCalledWith("tag-2");
  });
});
