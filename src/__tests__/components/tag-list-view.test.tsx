import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagListView } from "@/components/reader/tag-list-view";
import { TagSectionContextMenuView } from "@/components/reader/tag-section-context-menu-view";

describe("TagListView", () => {
  it("opens the tag section context menu from the actual tags header on right click", async () => {
    const onToggleOpen = vi.fn();

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
            onAddTag={vi.fn()}
            onManageTags={vi.fn()}
          />
        )}
        renderContextMenu={() => <div />}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Tags" });

    fireEvent.contextMenu(toggle);

    expect(onToggleOpen).not.toHaveBeenCalled();
    expect(await screen.findByRole("menuitem", { name: "Add tag" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Manage tags" })).toBeInTheDocument();
  });

  it("keeps left click on the tags header wired to section toggle when a section menu is available", async () => {
    const user = userEvent.setup();
    const onToggleOpen = vi.fn();

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
            onAddTag={vi.fn()}
            onManageTags={vi.fn()}
          />
        )}
        renderContextMenu={() => <div />}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tags" }));

    expect(onToggleOpen).toHaveBeenCalledTimes(1);
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
    expect(document.getElementById("sidebar-tag-section-panel")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("Later")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Work/ }));
    expect(onSelectTag).toHaveBeenCalledWith("tag-2");
  });

  it("marks the tags panel hidden when there are no visible tags even if the section is open", () => {
    render(
      <TagListView
        tagsLabel="Tags"
        tags={[]}
        isOpen={true}
        onToggleOpen={vi.fn()}
        onSelectTag={vi.fn()}
        renderTagSectionContextMenu={() => undefined}
        renderContextMenu={() => <div />}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Tags" });
    const panel = document.getElementById("sidebar-tag-section-panel");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.querySelector("svg")).toHaveClass("-rotate-90");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveClass("motion-disclosure-panel");
    expect(panel).toHaveAttribute("data-state", "closed");
  });
});
