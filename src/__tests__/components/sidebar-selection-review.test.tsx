import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarSelectionReviewCanvas } from "@/components/reader/sidebar-selection-review.stories";

describe("SidebarSelectionReviewCanvas", () => {
  it("renders the cross-component selection review scenarios", () => {
    render(<SidebarSelectionReviewCanvas />);

    expect(screen.getByText("Smart View / Unread Selected")).toHaveClass("text-sidebar-foreground/40");
    expect(screen.getByText("Smart View / Starred Selected")).toBeInTheDocument();
    expect(screen.getByText("Folder Selected")).toBeInTheDocument();
    expect(screen.getByText("Feed Selected / Idle")).toBeInTheDocument();
    expect(screen.getByText("Feed Selected / Hover Priority")).toBeInTheDocument();
    expect(screen.getByText("Tag Selected")).toBeInTheDocument();
    expect(screen.getByText("Smart View / Unread Selected").nextElementSibling).toHaveClass(
      "border-sidebar-border/30",
      "bg-sidebar/80",
    );

    expect(
      screen.getAllByRole("button", { name: /未読|スター|タグ|Comic|紛争でしたら八田まで|Red/ }).length,
    ).toBeGreaterThan(0);
  });
});
