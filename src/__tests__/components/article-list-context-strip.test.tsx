import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleListContextStrip } from "@/components/reader/article-list-context-strip";

describe("ArticleListContextStrip", () => {
  it("renders primary and secondary smart view pills as passive context", () => {
    render(<ArticleListContextStrip primaryLabel="Starred" secondaryLabel="ALL" />);
    const strip = screen.getByText("Starred").parentElement;

    expect(strip).not.toBeNull();
    if (!strip) {
      throw new Error("Expected context strip container");
    }

    expect(screen.getByText("Starred")).toHaveAttribute("data-emphasis", "primary");
    expect(screen.getByText("ALL")).toHaveAttribute("data-emphasis", "secondary");
    expect(screen.queryByRole("button", { name: "Starred" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ALL" })).not.toBeInTheDocument();
    expect(strip).not.toHaveAttribute("aria-label");
  });
});
