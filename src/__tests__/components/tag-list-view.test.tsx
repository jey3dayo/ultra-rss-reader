import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagListView } from "@/components/reader/tag-list-view";

describe("TagListView", () => {
  it("keeps section disclosure state independent from an empty tag list", () => {
    render(
      <TagListView
        tagsLabel="Tags"
        emptyLabel="No tags yet"
        isOpen
        onToggleOpen={vi.fn()}
        tags={[]}
        onSelectTag={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Tags" });
    const panel = document.querySelector("#sidebar-tag-section-panel");

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel).toHaveAttribute("data-empty", "true");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("No tags yet")).toBeInTheDocument();
    expect(screen.getByText("No tags yet")).toHaveClass("select-none");
    expect(screen.queryByRole("button", { name: "No tags yet" })).not.toBeInTheDocument();
  });

  it("uses the same section toggle inset as the subscriptions header", () => {
    render(<TagListView tagsLabel="Tags" isOpen onToggleOpen={vi.fn()} tags={[]} onSelectTag={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Tags" }).parentElement).toHaveClass("-mr-3", "px-3", "pt-3", "pb-1.5");
  });

  it("removes closed tag rows from the tab order", () => {
    render(
      <TagListView
        tagsLabel="Tags"
        isOpen={false}
        onToggleOpen={vi.fn()}
        tags={[{ id: "tag-1", name: "Important", color: null, articleCount: 1, isSelected: false }]}
        onSelectTag={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Tags" });
    const panel = document.querySelector("#sidebar-tag-section-panel");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("data-state", "closed");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: /Important/ })).not.toBeInTheDocument();
  });

  it("aligns tag rows to the folder icon rail", () => {
    render(
      <TagListView
        tagsLabel="Tags"
        isOpen
        onToggleOpen={vi.fn()}
        tags={[{ id: "tag-1", name: "Important", color: "#d97706", articleCount: 1, isSelected: false }]}
        onSelectTag={vi.fn()}
      />,
    );

    const tagButton = screen.getByRole("button", { name: /Important/ });

    expect(tagButton).toHaveClass("ml-[1.375rem]");
    expect(tagButton).toHaveClass("w-[calc(100%-1.375rem)]");
    expect(tagButton).toHaveClass("rounded-lg");
    expect(screen.getByText("1")).toHaveClass("min-w-8", "justify-end", "text-right");
    expect(screen.getByText("1")).not.toHaveClass("mr-1");
  });

  it("keeps the right-clicked tag as the context menu target when tag data updates while open", () => {
    const renderContextMenu = vi.fn((tag: { name: string }) => <div data-testid="tag-context-target">{tag.name}</div>);
    const makeTagList = (name: string) => (
      <TagListView
        tagsLabel="Tags"
        isOpen
        onToggleOpen={vi.fn()}
        tags={[{ id: "tag-1", name, color: null, articleCount: 1, isSelected: false }]}
        onSelectTag={vi.fn()}
        renderContextMenu={renderContextMenu}
      />
    );

    const { rerender } = render(makeTagList("Important"));

    fireEvent.contextMenu(screen.getByRole("button", { name: /Important/ }));
    rerender(makeTagList("Renamed tag"));

    expect(screen.getByTestId("tag-context-target")).toHaveTextContent("Important");
  });
});
