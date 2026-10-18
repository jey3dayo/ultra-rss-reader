import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { ArticleReaderBody } from "@/components/reader/article-reader-body";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

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

const baseFeed: FeedDto = {
  id: "feed-1",
  account_id: "acc-1",
  folder_id: null,
  remote_id: null,
  title: "Tech Blog",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com/blog?token=secret",
  icon_url: null,
  unread_count: 0,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
};

describe("ArticleReaderBody", () => {
  beforeEach(() => {
    openArticleInExternalBrowserMock.mockClear();
    useUiStore.setState({ ...useUiStore.getInitialState(), selectedArticleId: baseArticle.id, contentMode: "reader" });
    usePreferencesStore.setState({ prefs: { open_links: "default_browser" } });
  });

  it("resolves relative content links against the article URL", () => {
    render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);

    fireEvent.click(screen.getByRole("link", { name: "Read more" }));

    expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/posts/1");
  });

  it("opens the feed site link in the external browser on click and middle-click with a host-only tooltip", () => {
    render(<ArticleReaderBody article={baseArticle} feed={baseFeed} feedName="Tech Blog" hasNextArticle={true} />);

    const link = screen.getByRole("link", { name: /example\.com/ });
    expect(link).toHaveAttribute("title", "Open in external browser — example.com");

    fireEvent.click(link);
    expect(openArticleInExternalBrowserMock).toHaveBeenCalledTimes(1);
    expect(openArticleInExternalBrowserMock).toHaveBeenLastCalledWith("https://example.com/blog?token=secret");

    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(openArticleInExternalBrowserMock).toHaveBeenCalledTimes(2);
    expect(openArticleInExternalBrowserMock).toHaveBeenLastCalledWith("https://example.com/blog?token=secret");
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

  it.each([{ metaKey: true }, { ctrlKey: true }, { button: 1 }])(
    "routes modified content clicks externally through the reader opener: %j",
    (modifiers) => {
      usePreferencesStore.setState({ prefs: { open_links: "in_app" } });
      render(<ArticleReaderBody article={baseArticle} />);
      const event = new MouseEvent(modifiers.button ? "auxclick" : "click", {
        bubbles: true,
        cancelable: true,
        ...modifiers,
      });
      const defaultAllowed = screen.getByRole("link", { name: "Read more" }).dispatchEvent(event);
      expect(defaultAllowed).toBe(false);
      expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/posts/1");
      expect(useUiStore.getState().browserUrl).toBeNull();
    },
  );

  it("routes title, content, and detail site links in-app by preference", () => {
    usePreferencesStore.setState({ prefs: { open_links: "in_app" } });
    render(<ArticleReaderBody article={baseArticle} feed={baseFeed} />);
    fireEvent.click(screen.getByRole("button", { name: "Article title" }));
    expect(useUiStore.getState().browserUrl).toBe(baseArticle.url);
    fireEvent.click(screen.getByRole("link", { name: "Read more" }));
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/posts/1");
    const site = screen.getByRole("link", { name: /example\.com/ });
    expect(site).toHaveAttribute("title", "Open in app — example.com");
    fireEvent.click(site);
    expect(useUiStore.getState().browserUrl).toBe(baseFeed.site_url);
    expect(openArticleInExternalBrowserMock).not.toHaveBeenCalled();
  });

  it("requires confirmation for private content and detail site links without exposing URL secrets", () => {
    usePreferencesStore.setState({ prefs: { open_links: "in_app" } });
    render(
      <ArticleReaderBody
        article={{
          ...baseArticle,
          content_sanitized: '<p><a href="http://localhost/private?token=secret">Private content</a></p>',
        }}
        feed={{ ...baseFeed, site_url: "http://localhost/private?token=secret" }}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "Private content" }));
    expect(useUiStore.getState().browserUrl).toBeNull();
    const firstConfirm = useUiStore.getState().confirmDialog;
    expect(firstConfirm.message).toContain("localhost");
    expect(firstConfirm.message).not.toMatch(/private\?|token=|secret/);
    useUiStore.getState().closeConfirm();
    firstConfirm.onConfirm?.();
    expect(useUiStore.getState().browserUrl).toBeNull();
    const site = screen.getByRole("link", { name: "localhost" });
    expect(site).toHaveAttribute("title", "Confirmation required for a private host — localhost");
    fireEvent.click(site);
    useUiStore.getState().confirmDialog.onConfirm?.();
    expect(useUiStore.getState().browserUrl).toBe("http://localhost/private?token=secret");
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

  function getReaderViewport(): HTMLElement {
    const viewport = screen
      .getByTestId("article-reader-scroll-area")
      .querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) {
      throw new Error("Expected article reader viewport");
    }
    return viewport;
  }

  it("does not restore the pruned scroll entry through the unmount cleanup after the article is closed", () => {
    useUiStore.setState({
      articleReaderScrollPositions: new Map([
        ["article-1", 240],
        ["article-2", 480],
      ]),
    });
    const { unmount } = render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);
    getReaderViewport().scrollTop = 640;

    useUiStore.getState().clearArticle();
    unmount();

    expect(useUiStore.getState().articleReaderScrollPositions.has("article-1")).toBe(false);
    expect(useUiStore.getState().articleReaderScrollPositions.get("article-2")).toBe(480);
  });

  it("does not restore the pruned scroll entry through a pending commit flushed after close", () => {
    const { unmount } = render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);
    const viewport = getReaderViewport();
    viewport.scrollTop = 280;
    fireEvent.scroll(viewport);

    useUiStore.getState().clearArticle();
    unmount();

    expect(useUiStore.getState().articleReaderScrollPositions.has("article-1")).toBe(false);
  });

  it("persists the viewport scroll position on unmount while the article stays selected", () => {
    const { unmount } = render(<ArticleReaderBody article={baseArticle} hasNextArticle={true} />);
    getReaderViewport().scrollTop = 320;

    unmount();

    expect(useUiStore.getState().articleReaderScrollPositions.get("article-1")).toBe(320);
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
