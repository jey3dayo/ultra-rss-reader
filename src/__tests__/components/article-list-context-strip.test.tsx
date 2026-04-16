import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleListContextStrip } from "@/components/reader/article-list-context-strip";

describe("ArticleListContextStrip", () => {
  it("renders smart view context as a band with a tone hint", () => {
    render(<ArticleListContextStrip primaryLabel="Starred" tone="starred" />);
    const strip = screen.getByTestId("article-list-context-strip");
    const label = screen.getByText("Starred");

    expect(strip).not.toBeNull();
    if (!strip) {
      throw new Error("Expected context strip container");
    }

    expect(label).toHaveAttribute("data-emphasis", "primary");
    expect(label).toHaveClass(
      "text-[color-mix(in_srgb,var(--tone-starred)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]",
    );
    expect(label).toHaveClass("tracking-[0.12em]");
    expect(strip).toHaveAttribute("data-style", "band");
    expect(strip).toHaveAttribute("data-tone", "starred");
    expect(strip).toHaveClass("border-[var(--reader-context-border)]");
    expect(screen.queryByRole("button", { name: "Starred" })).not.toBeInTheDocument();
    expect(strip).not.toHaveAttribute("aria-label");
  });

  it("emphasizes unread context more strongly than neutral section labels", () => {
    render(<ArticleListContextStrip primaryLabel="Unread" tone="unread" />);

    expect(screen.getByText("Unread")).toHaveClass(
      "font-semibold",
      "text-[color-mix(in_srgb,var(--tone-unread)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]",
    );
  });
});
