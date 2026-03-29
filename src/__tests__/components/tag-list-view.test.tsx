import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagListView } from "@/components/reader/tag-list-view";

vi.mock("@/components/reader/tag-context-menu", () => ({
  TagContextMenuContent: () => null,
}));

describe("TagListView", () => {
  it("renders tag rows with counts and selects the clicked tag", async () => {
    const user = userEvent.setup();
    const onSelectTag = vi.fn();

    render(
      <TagListView
        tagsLabel="Tags"
        isOpen={true}
        onToggleOpen={vi.fn()}
        tags={[
          { id: "tag-1", name: "Later", color: "#3b82f6", articleCount: 2, isSelected: true },
          { id: "tag-2", name: "Work", color: null, articleCount: 0, isSelected: false },
        ]}
        onSelectTag={onSelectTag}
      />,
    );

    expect(screen.getByRole("button", { name: "Tags" })).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Work/ }));
    expect(onSelectTag).toHaveBeenCalledWith("tag-2");
  });
});
