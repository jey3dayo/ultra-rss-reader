import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagListView } from "@/components/reader/tag-list-view";

describe("TagListView", () => {
  it("keeps section disclosure state independent from an empty tag list", () => {
    render(<TagListView tagsLabel="Tags" isOpen onToggleOpen={vi.fn()} tags={[]} onSelectTag={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: "Tags" });
    const panel = document.querySelector("#sidebar-tag-section-panel");

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel).toHaveAttribute("aria-hidden", "false");
  });
});
