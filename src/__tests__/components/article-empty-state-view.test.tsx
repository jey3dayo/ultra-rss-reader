import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleEmptyStateView } from "@/components/reader/article-empty-state-view";

describe("ArticleEmptyStateView", () => {
  it("renders the placeholder message with follow-up guidance", () => {
    render(
      <ArticleEmptyStateView
        message="Select an article to read"
        hints={["Pick one from the list", "Press / to search", "Open Web Preview from the toolbar"]}
      />,
    );

    expect(screen.getByText("Select an article to read")).toBeInTheDocument();
    expect(screen.getByText("Pick one from the list")).toBeInTheDocument();
    expect(screen.getByText("Press / to search")).toBeInTheDocument();
    expect(screen.getByText("Open Web Preview from the toolbar")).toBeInTheDocument();
  });

  it("left-aligns the message and guidance for easier scanning", () => {
    const { container } = render(
      <ArticleEmptyStateView
        message="Select an article to read"
        hints={["Pick one from the list", "Press / to search"]}
      />,
    );

    expect(screen.getByText("Select an article to read")).toHaveClass("text-left");
    expect(screen.getByText("Pick one from the list").closest("ul")).toHaveClass("text-left");
    expect(container.querySelector("li")).toHaveClass("justify-start");
  });
});
