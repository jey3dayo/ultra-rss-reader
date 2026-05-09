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
    render(<ArticleReaderBody article={baseArticle} />);

    fireEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/posts/1");
  });

  it("does not open relative content links without an article URL base", () => {
    render(<ArticleReaderBody article={{ ...baseArticle, url: "" }} />);

    fireEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(openArticleInExternalBrowserMock).not.toHaveBeenCalled();
  });
});
