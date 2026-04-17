import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import feedTreeStories, { SelectionPriorityReview } from "@/components/reader/feed-tree-view.stories";

describe("FeedTreeView stories", () => {
  it("uses softened review captions and frame tones in the selection review story", () => {
    render(SelectionPriorityReview.render?.(feedTreeStories.args ?? {}, {} as never) ?? null);

    expect(screen.getByText("Selected idle")).toHaveClass("text-sidebar-foreground/40");
    expect(screen.getByText("Selected hover priority")).toHaveClass("text-sidebar-foreground/40");
    expect(screen.getByText("Unselected hover")).toHaveClass("text-sidebar-foreground/40");
    expect(screen.getByText("Selected idle").nextElementSibling).toHaveClass(
      "border-[var(--feed-tree-review-frame-border)]",
      "bg-[var(--feed-tree-review-frame-surface)]",
    );
  });
});
