import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarFeedTreeSkeleton } from "@/components/reader/sidebar-feed-tree-skeleton";

describe("SidebarFeedTreeSkeleton", () => {
  it("keeps the row rhythm and icon skeleton shape stable", () => {
    const { container } = render(<SidebarFeedTreeSkeleton label="Loading feeds" />);

    expect(screen.getByRole("status")).toHaveClass("p-2");
    expect(screen.getByText("Loading feeds")).toHaveClass("sr-only");

    const rows = container.querySelectorAll(".rounded-md.px-2.py-1\\.5");
    expect(rows).toHaveLength(5);

    const firstIconSkeleton = rows[0]?.firstElementChild;
    expect(firstIconSkeleton).toHaveClass("size-3.5", "rounded-sm", "bg-surface-4/70");
    expect(firstIconSkeleton).not.toHaveClass("h-3.5", "w-3.5");
  });
});
