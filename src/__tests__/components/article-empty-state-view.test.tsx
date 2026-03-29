import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleEmptyStateView } from "@/components/reader/article-empty-state-view";

describe("ArticleEmptyStateView", () => {
  it("renders the placeholder message", () => {
    render(<ArticleEmptyStateView message="Select an article to read" />);

    expect(screen.getByText("Select an article to read")).toBeInTheDocument();
  });
});
