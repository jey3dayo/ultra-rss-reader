import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleListContextStrip } from "@/components/reader/article-list-context-strip";

describe("ArticleListContextStrip", () => {
  it("renders smart view context as quiet list metadata", () => {
    render(<ArticleListContextStrip primaryLabel="Starred" tone="starred" />);
    const strip = screen.getByTestId("article-list-context-strip");
    const label = screen.getByText("Starred");

    expect(strip).not.toBeNull();
    if (!strip) {
      throw new Error("Expected context strip container");
    }

    expect(label).toHaveAttribute("data-emphasis", "primary");
    expect(label).toHaveClass("text-[var(--sidebar-foreground-soft-strong)]");
    expect(label).toHaveClass("tracking-[0.04em]");
    expect(label).not.toHaveClass("uppercase");
    expect(strip).toHaveAttribute("data-style", "metadata");
    expect(strip).toHaveAttribute("data-tone", "starred");
    expect(strip).toHaveAttribute("data-motion-phase", "entering");
    expect(strip).toHaveClass("motion-content-swap");
    expect(strip).toHaveClass("select-none");
    expect(strip).toHaveClass("border-[var(--reader-context-border)]");
    expect(strip).toHaveClass("bg-transparent", "h-8");
    expect(screen.queryByRole("button", { name: "Starred" })).not.toBeInTheDocument();
    expect(strip).not.toHaveAttribute("aria-label");
  });

  it("keeps unread context in the same quiet metadata tone", () => {
    render(<ArticleListContextStrip primaryLabel="Unread" tone="unread" />);

    expect(screen.getByText("Unread")).toHaveClass("font-medium", "text-[var(--sidebar-foreground-soft-strong)]");
    expect(screen.getByText("Unread")).not.toHaveClass("font-semibold");
  });

  it("keeps the secondary label on a neutral supporting tone for semantic strips", () => {
    render(<ArticleListContextStrip primaryLabel="Unread" secondaryLabel="12 items" tone="unread" />);

    const secondaryLabel = screen.getByText("12 items");

    expect(secondaryLabel).toHaveAttribute("data-emphasis", "secondary");
    expect(secondaryLabel).toHaveClass("text-[var(--sidebar-foreground-soft-strong)]");
    expect(secondaryLabel).toHaveClass("tracking-[0.04em]");
    expect(secondaryLabel).not.toHaveClass("uppercase");
  });
});
