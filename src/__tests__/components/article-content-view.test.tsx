import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContentView } from "@/components/reader/article-content-view";
import articleContentViewStories from "@/components/reader/article-content-view.stories";

describe("ArticleContentView", () => {
  it("renders a thumbnail and sanitized html content", () => {
    const { container } = render(
      <ArticleContentView
        thumbnailUrl="https://example.com/thumbnail.png"
        contentHtml="<p>Hello <strong>world</strong> <a href='https://example.com'>link</a></p>"
      />,
    );

    expect(screen.getByAltText("")).toHaveAttribute("src", "https://example.com/thumbnail.png");
    expect(screen.getByText("Hello", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "https://example.com");
    expect(container.querySelector(".prose")).not.toBeNull();
  });

  it("omits the thumbnail wrapper when no image is provided", () => {
    const { container } = render(<ArticleContentView contentHtml="<p>Only text</p>" />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Only text")).toBeInTheDocument();
  });

  it("uses a fixture-only thumbnail in storybook", () => {
    expect(articleContentViewStories.args?.thumbnailUrl).toBeTruthy();
    expect(articleContentViewStories.args?.thumbnailUrl).not.toMatch(/^https?:\/\//);
  });
});
