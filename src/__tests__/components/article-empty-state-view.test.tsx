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
    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump to sidebar" })).toBeInTheDocument();
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

  it("renders the empty-state container as a surfaced welcome card in reader mode", () => {
    render(
      <ArticleEmptyStateView
        eyebrow="Reader ready"
        message="Select an article to read"
        description="Choose a scope on the left, then open something from the middle queue to start reading."
        hints={["Pick one from the list"]}
      />,
    );

    const container = screen.getByText("Select an article to read").parentElement;
    const hintsList = screen.getByRole("list");

    expect(container).toHaveClass("max-w-2xl");
    expect(container).toHaveClass("rounded-3xl");
    expect(container).toHaveClass("border");
    expect(container).toHaveClass("px-7");
    expect(container).toHaveClass("py-7");
    expect(container).toHaveClass("min-h-44");
    expect(container).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Reader ready")).toHaveClass("uppercase");
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

    expect(container).toHaveClass("max-w-2xl");
    expect(container).toHaveClass("px-7");
    expect(container).toHaveClass("py-7");
    expect(container).toHaveClass("min-h-44");
    expect(screen.getByText("Add your first feed")).toHaveClass("text-left");
    expect(hintsList).toHaveClass("text-left");
    expect(hintsList).toHaveClass("pl-5");
  });
});
