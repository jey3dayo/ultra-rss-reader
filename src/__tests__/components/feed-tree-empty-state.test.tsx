import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedTreeEmptyState } from "@/components/reader/feed-tree-empty-state";

describe("FeedTreeEmptyState", () => {
  it("uses softened tones for loading and action affordances", () => {
    const onAction = vi.fn();
    const { rerender } = render(<FeedTreeEmptyState kind="loading" text="Loading feeds…" />);

    expect(screen.getByText("Loading feeds…").previousElementSibling).toHaveClass("bg-foreground-soft/50");

    rerender(<FeedTreeEmptyState kind="action" text="Add your first feed" onAction={onAction} />);

    expect(screen.getByRole("button", { name: "Add your first feed" })).toHaveClass(
      "text-foreground-soft",
      "hover:text-foreground",
    );
  });
});
