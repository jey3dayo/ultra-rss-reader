import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleEmptyStateView } from "@/components/reader/article-empty-state-view";

describe("ArticleEmptyStateView", () => {
  it("renders the placeholder message with follow-up guidance", () => {
    const onPrimaryAction = vi.fn();
    const onSecondaryAction = vi.fn();

    render(
      <ArticleEmptyStateView
        eyebrow="Reader ready"
        message="Select an article to read"
        description="Choose a scope on the left, then open something from the middle queue to start reading."
        hints={["Pick one from the list", "Press / to search", "Open Web Preview from the toolbar"]}
        actions={[
          { label: "Open settings", onClick: onPrimaryAction },
          { label: "Jump to sidebar", onClick: onSecondaryAction, variant: "outline" },
        ]}
      />,
    );

    expect(screen.getByText("Reader ready")).toBeInTheDocument();
    expect(screen.getByText("Select an article to read")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a scope on the left, then open something from the middle queue to start reading."),
    ).toBeInTheDocument();
    expect(screen.getByText("Pick one from the list")).toBeInTheDocument();
    expect(screen.getByText("Press / to search")).toBeInTheDocument();
    expect(screen.getByText("Open Web Preview from the toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open settings" })).toHaveAttribute("data-reader-passive-action", "true");
    expect(screen.getByRole("button", { name: "Jump to sidebar" })).toHaveAttribute(
      "data-reader-passive-action",
      "true",
    );
  });

  it("center-aligns the message and guidance as an unboxed empty state", () => {
    render(
      <ArticleEmptyStateView
        message="Select an article to read"
        hints={["Pick one from the list", "Press / to search"]}
      />,
    );

    const layout = screen.getByText("Select an article to read").parentElement;
    expect(layout).toHaveClass("flex-col", "items-center", "text-center");
    expect(screen.getByText("Pick one from the list").closest("ul")).toHaveClass("text-center");
  });

  it("renders without card chrome and keeps the optical offset on the outer layout", () => {
    render(
      <ArticleEmptyStateView
        eyebrow="Reader ready"
        message="Select an article to read"
        description="Choose a scope on the left, then open something from the middle queue to start reading."
        hints={["Pick one from the list"]}
        containerClassName="-translate-y-[14%] md:-translate-y-[16%]"
      />,
    );

    const container = screen.getByText("Select an article to read").parentElement;
    const layout = container?.parentElement;

    expect(container).toHaveClass("max-w-[26rem]");
    expect(container).not.toHaveClass("rounded-md");
    expect(container).not.toHaveClass("border");
    expect(container).not.toHaveClass("shadow-[var(--shadow-elevation-1)]");
    expect(layout).toHaveClass("-translate-y-[14%]");
    expect(screen.getByText("Reader ready")).toHaveClass("uppercase");
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

    expect(list).toHaveClass("text-center");
    expect(firstHint.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("keeps the same layout for setup guidance variants", () => {
    render(
      <ArticleEmptyStateView
        message="Add your first feed"
        hints={[
          "Use the + button in the top-left to add a feed.",
          "Paste a site URL or feed URL to discover feeds automatically.",
        ]}
      />,
    );

    const container = screen.getByText("Add your first feed").parentElement;
    const hintsList = screen.getByRole("list");

    expect(container).toHaveClass("max-w-[26rem]", "flex-col", "items-center");
    expect(container).not.toHaveClass("border");
    expect(hintsList).toHaveClass("text-center");
  });
});
