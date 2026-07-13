import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import { ArticleReaderBody } from "@/components/reader/article-reader-body";

const openArticleInExternalBrowserMock = vi.fn();

vi.mock("@/components/reader/article-browser-actions", () => ({
  openArticleInExternalBrowser: (url: string) => openArticleInExternalBrowserMock(url),
}));

vi.mock("@/components/reader/article-tag-chips", () => ({
  ArticleTagChips: () => null,
}));

const baseArticle: ArticleDto = {
  id: "article-1",
  feed_id: "feed-1",
  title: "Article title",
  content_sanitized: '<p><a href="/posts/1">Read more</a></p>',
  summary: null,
  url: "https://example.com/articles/source",
  author: null,
  published_at: "2026-04-01T09:00:00Z",
  thumbnail: null,
  is_read: false,
  is_starred: false,
};

describe("ArticleReaderBody", () => {
  beforeEach(() => {
    openArticleInExternalBrowserMock.mockClear();
  });

  it("resolves relative content links against the article URL", () => {
    render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);

    fireEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/posts/1");
  });

  it("lets the reader content expand across the right pane with viewport-responsive padding", () => {
    const { container } = render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);

    const readerContent = container.querySelector("[data-article-slide-content]");

    expect(readerContent).toHaveClass("w-full", "px-[clamp(1.75rem,3vw,4rem)]");
    expect(readerContent).not.toHaveClass("max-w-[44rem]");
    expect(readerContent).not.toHaveClass("max-w-[72rem]");
  });

  it("delegates content link clicks added after the article body renders", () => {
    const { container } = render(
      <ArticleReaderBody article={{ ...baseArticle, content_sanitized: "<p>Body</p>" }} hasNextArticle={true} />,
    );
    const contentContainer = container.querySelector("[data-article-content-container]");
    const dynamicLink = document.createElement("a");
    dynamicLink.href = "/posts/dynamic";
    dynamicLink.textContent = "Dynamic link";
    contentContainer?.append(dynamicLink);

    fireEvent.click(dynamicLink);

    expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/posts/dynamic");
  });

  it("delegates nested element clicks to the owning content link", () => {
    render(
      <ArticleReaderBody
        article={{
          ...baseArticle,
          content_sanitized: '<p><a href="/posts/nested"><span>Nested link</span></a></p>',
        }}
        hasNextArticle={true}
      />,
    );

    fireEvent.click(screen.getByText("Nested link"));

    expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/posts/nested");
  });

  it("does not intercept modified content link clicks", () => {
    render(
      <ArticleReaderBody
        article={{ ...baseArticle, content_sanitized: '<p><a href="#email">Email</a></p>' }}
        hasNextArticle={true}
      />,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });

    const defaultAllowed = screen.getByRole("link", { name: "Email" }).dispatchEvent(event);

    expect(defaultAllowed).toBe(true);
    expect(openArticleInExternalBrowserMock).not.toHaveBeenCalled();
  });

  it("does not open relative content links without an article URL base", () => {
    render(<ArticleReaderBody article={{ ...baseArticle, url: "" }} hasNextArticle={true} />);

    fireEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(openArticleInExternalBrowserMock).not.toHaveBeenCalled();
  });

  it("shows the floating next-article button when a next article exists", () => {
    render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);

    expect(screen.getByRole("button", { name: "Next article" })).toBeInTheDocument();
  });

  it("hides the floating next-article button on the last article", () => {
    render(<ArticleReaderBody article={baseArticle} hasNextArticle={false} />);

    expect(screen.queryByRole("button", { name: "Next article" })).not.toBeInTheDocument();
  });

  it("cleans up delegated content link clicks when switching articles", () => {
    const { rerender } = render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);
    const oldLink = screen.getByRole("link", { name: "Read more" });
    oldLink.addEventListener("click", (event) => {
      event.preventDefault();
    });

    rerender(
      <ArticleReaderBody
        article={{
          ...baseArticle,
          id: "article-2",
          content_sanitized: '<p><a href="/posts/2">Second article</a></p>',
        }}
        hasNextArticle={true}
      />,
    );

    fireEvent.click(oldLink);
    fireEvent.click(screen.getByRole("link", { name: "Second article" }));

    expect(openArticleInExternalBrowserMock).toHaveBeenCalledTimes(1);
    expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/posts/2");
  });
});
