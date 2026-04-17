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
    render(
      <ArticleEmptyStateView
        message="Select an article to read"
        hints={["Pick one from the list", "Press / to search"]}
      />,
    );

    expect(screen.getByText("Select an article to read")).toHaveClass("text-left");
    expect(screen.getByText("Pick one from the list").closest("ul")).toHaveClass("text-left");
    expect(screen.getByText("Pick one from the list").closest("ul")).toHaveClass("pl-5");
  });

  it("uses semantic surface tokens for the empty-state container", () => {
    render(<ArticleEmptyStateView message="Select an article to read" hints={["Pick one from the list"]} />);

    const container = screen.getByText("Select an article to read").parentElement;
    const hintsList = screen.getByRole("list");

    expect(container).toHaveAttribute("data-surface-card", "info");
    expect(container).toHaveClass("rounded-md");
    expect(container).toHaveClass("max-w-xl");
    expect(container).toHaveClass("border-border/0");
    expect(container).toHaveClass("bg-surface-1/0");
    expect(container).toHaveClass("shadow-none");
    expect(container).toHaveClass("text-foreground-soft");
    expect(screen.queryByText("Reader")).not.toBeInTheDocument();
    expect(hintsList).toHaveClass("marker:text-foreground-soft");
  });

  it("uses semantic list markers so wrapped hints stay aligned", () => {
    render(
      <ArticleEmptyStateView
        message="Select an article to read"
        hints={["Open the article list to start reading immediately"]}
      />,
    );

    const list = screen.getByRole("list");
    const [firstHint] = screen.getAllByRole("listitem");

    expect(list).toHaveClass("list-disc");
    expect(list).toHaveClass("pl-5");
    expect(firstHint.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
