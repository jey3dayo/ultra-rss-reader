import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleListContextStrip } from "@/components/reader/article-list-context-strip";

describe("ArticleListContextStrip", () => {
  it("renders smart view context as a band with a tone hint", () => {
    render(<ArticleListContextStrip primaryLabel="Starred" tone="starred" />);
    const strip = screen.getByTestId("article-list-context-strip");

    expect(strip).not.toBeNull();
    if (!strip) {
      throw new Error("Expected context strip container");
    }

    expect(screen.getByText("Starred")).toHaveAttribute("data-emphasis", "primary");
    expect(strip).toHaveAttribute("data-style", "band");
    expect(strip).toHaveAttribute("data-tone", "starred");
    expect(screen.queryByRole("button", { name: "Starred" })).not.toBeInTheDocument();
    expect(strip).not.toHaveAttribute("aria-label");
  });
});
