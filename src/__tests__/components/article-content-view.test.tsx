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

    const thumbnail = screen.getByAltText("");
    expect(thumbnail).toHaveAttribute("src", "https://example.com/thumbnail.png");
    expect(thumbnail.parentElement).toHaveClass("mb-10");
    expect(thumbnail.parentElement).toHaveClass("rounded-md", "bg-surface-1/70");
    expect(screen.getByText("Hello", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "https://example.com");
    const prose = container.querySelector(".prose");
    expect(prose).not.toBeNull();
    expect(prose).toHaveClass("text-[1.02rem]");
    expect(prose).toHaveClass("leading-8");
  });

  it("omits the thumbnail wrapper when no image is provided", () => {
    const { container } = render(<ArticleContentView contentHtml="<p>Only text</p>" />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Only text")).toBeInTheDocument();
  });

  it("hides a duplicated feed-name label at the start of article content", () => {
    const { container } = render(
      <ArticleContentView
        feedName="葬送のフリーレン"
        contentHtml="<p>葬送のフリーレン</p><p>本文です</p><figure><p><img src='https://example.com/panel.png' alt='' /></p></figure>"
      />,
    );

    expect(screen.getByText("本文です")).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", "https://example.com/panel.png");
    expect(container.querySelector(".prose")?.textContent?.trim()).toBe("本文です");
  });

  it("keeps the opening content when it does not duplicate the feed name", () => {
    render(
      <ArticleContentView feedName="葬送のフリーレン" contentHtml="<p>第147話 英雄のいない地</p><p>本文です</p>" />,
    );

    expect(screen.getByText("第147話 英雄のいない地")).toBeInTheDocument();
    expect(screen.getByText("本文です")).toBeInTheDocument();
  });

  it("uses a fixture-only thumbnail in storybook", () => {
    expect(articleContentViewStories.args?.thumbnailUrl).toBeTruthy();
    expect(articleContentViewStories.args?.thumbnailUrl).not.toMatch(/^https?:\/\//);
  });
});
