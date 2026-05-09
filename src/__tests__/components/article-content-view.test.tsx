import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleContentView, fromSanitizedArticleHtml } from "@/components/reader/article-content-view";
import articleContentViewStories from "@/components/reader/article-content-view.stories";

describe("ArticleContentView", () => {
  it("renders a thumbnail and sanitized html content", () => {
    const { container } = render(
      <ArticleContentView
        thumbnailUrl="https://example.com/thumbnail.png"
        contentHtml={fromSanitizedArticleHtml(
          "<p>Hello <strong>world</strong> <a href='https://example.com'>link</a></p>",
        )}
      />,
    );

    const thumbnail = screen.getByAltText("");
    expect(thumbnail).toHaveAttribute("src", "https://example.com/thumbnail.png");
    expect(thumbnail).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(thumbnail.parentElement).toHaveClass("mb-10");
    expect(thumbnail.parentElement).toHaveClass("rounded-lg", "bg-surface-1/70");
    expect(screen.getByText("Hello", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "https://example.com");
    const prose = container.querySelector(".prose");
    expect(prose).not.toBeNull();
    expect(prose).toHaveClass("text-[1.02rem]");
    expect(prose).toHaveClass("leading-8");
    expect(prose).toHaveClass("text-foreground");
  });

  it("omits the thumbnail wrapper when no image is provided", () => {
    const { container } = render(<ArticleContentView contentHtml={fromSanitizedArticleHtml("<p>Only text</p>")} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Only text")).toBeInTheDocument();
  });

  it("omits article thumbnails that are outside the reader image policy", () => {
    const { container, rerender } = render(
      <ArticleContentView
        thumbnailUrl="http://example.com/thumbnail.png"
        contentHtml={fromSanitizedArticleHtml("<p>Only text</p>")}
      />,
    );

    expect(container.querySelector("img")).toBeNull();

    rerender(
      <ArticleContentView
        thumbnailUrl="data:image/svg+xml,<svg></svg>"
        contentHtml={fromSanitizedArticleHtml("<p>Only text</p>")}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("hides a duplicated feed-name label at the start of article content", () => {
    const { container } = render(
      <ArticleContentView
        feedName="葬送のフリーレン"
        contentHtml={fromSanitizedArticleHtml(
          "<p>葬送のフリーレン</p><p>本文です</p><figure><p><img src='https://example.com/panel.png' alt='' /></p></figure>",
        )}
      />,
    );

    expect(screen.getByText("本文です")).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", "https://example.com/panel.png");
    expect(container.querySelector(".prose")?.textContent?.trim()).toBe("本文です");
  });

  it("keeps the opening content when it does not duplicate the feed name", () => {
    render(
      <ArticleContentView
        feedName="葬送のフリーレン"
        contentHtml={fromSanitizedArticleHtml("<p>第147話 英雄のいない地</p><p>本文です</p>")}
      />,
    );

    expect(screen.getByText("第147話 英雄のいない地")).toBeInTheDocument();
    expect(screen.getByText("本文です")).toBeInTheDocument();
  });

  it("hides placeholder null article bodies", () => {
    const { container, rerender } = render(<ArticleContentView contentHtml={fromSanitizedArticleHtml("null")} />);

    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(container.querySelector(".prose")?.textContent?.trim()).toBe("");

    rerender(<ArticleContentView contentHtml={fromSanitizedArticleHtml("<p>null</p>")} />);

    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(container.querySelector(".prose")?.textContent?.trim()).toBe("");
  });

  it("uses a fixture-only thumbnail in storybook", () => {
    expect(articleContentViewStories.args?.thumbnailUrl).toBeTruthy();
    expect(articleContentViewStories.args?.thumbnailUrl).not.toMatch(/^https?:\/\//);
  });

  it("keeps sanitized HTML branding as a type-only danger boundary", () => {
    const sanitizedHtml = "<p data-source='rust-sanitizer'>Safe <em>content</em></p>";

    expect(fromSanitizedArticleHtml(sanitizedHtml)).toBe(sanitizedHtml);
  });

  it("does not re-sanitize content at the React danger boundary", () => {
    const rustSanitizedHtml = fromSanitizedArticleHtml(
      "<p>Safe body</p><a href='https://example.com/article' rel='noopener noreferrer'>Read more</a>",
    );

    const { container } = render(<ArticleContentView contentHtml={rustSanitizedHtml} />);

    expect(screen.getByText("Safe body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("href", "https://example.com/article");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
  });

  it("keeps reader remote images separate from Web Preview frame behavior", () => {
    const { container } = render(
      <ArticleContentView
        thumbnailUrl="https://cdn.example.com/thumbnail.jpg"
        contentHtml={fromSanitizedArticleHtml(
          "<p>Article body</p><img src='https://cdn.example.com/body.jpg' alt='Body image' />",
        )}
      />,
    );

    expect(screen.getByAltText("")).toHaveAttribute("src", "https://cdn.example.com/thumbnail.jpg");
    expect(screen.getByRole("img", { name: "Body image" })).toHaveAttribute("src", "https://cdn.example.com/body.jpg");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-browser-webview-iframe]")).toBeNull();
  });
});
