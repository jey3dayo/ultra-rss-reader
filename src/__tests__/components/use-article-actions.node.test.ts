import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import { useArticleActions } from "@/components/reader/hooks/article/use-article-actions";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

const { addArticleToReadingListMock, copyArticleLinkMock, openArticleInExternalBrowserMock } = vi.hoisted(() => ({
  addArticleToReadingListMock: vi.fn(),
  copyArticleLinkMock: vi.fn(),
  openArticleInExternalBrowserMock: vi.fn(),
}));

vi.mock("@/components/reader/article-browser-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/reader/article-browser-actions")>();
  return {
    ...actual,
    addArticleToReadingList: addArticleToReadingListMock,
    copyArticleLink: copyArticleLinkMock,
    openArticleInExternalBrowser: openArticleInExternalBrowserMock,
  };
});

const article = {
  id: "art-1",
  feed_id: "feed-1",
  title: "First Article",
  content_sanitized: "<p>Hello world</p>",
  summary: "A hello world article",
  url: "https://example.com/article",
  author: "Alice",
  published_at: "2026-03-25T10:00:00Z",
  thumbnail: null,
  is_read: false,
  is_starred: false,
} satisfies ArticleDto;

function renderArticleActions(articleValue: ArticleDto | null) {
  return renderHook(() =>
    useArticleActions({
      article: articleValue,
      viewMode: "all",
      retainOnUnstar: false,
      supportsReadingList: true,
      showToast: vi.fn(),
      addRecentlyRead: vi.fn(),
      removeRecentlyRead: vi.fn(),
      retainArticle: vi.fn(),
      setRead: { mutate: vi.fn() },
      toggleStar: { mutate: vi.fn() },
    }),
  );
}

describe("useArticleActions", () => {
  beforeEach(() => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedArticleId: "art-1",
      contentMode: "reader",
    });
    addArticleToReadingListMock.mockReset();
    copyArticleLinkMock.mockReset();
    openArticleInExternalBrowserMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("ignores native-menu share events while Web Preview has no selected article URL", () => {
    useUiStore.setState({
      selectedArticleId: null,
      contentMode: "browser",
      browserUrl: "https://example.com/stale-preview",
    });

    renderArticleActions(null);

    window.dispatchEvent(new Event(keyboardEvents.openExternalBrowser));
    window.dispatchEvent(new Event(keyboardEvents.copyLink));
    window.dispatchEvent(new Event(keyboardEvents.addToReadingList));

    expect(openArticleInExternalBrowserMock).not.toHaveBeenCalled();
    expect(copyArticleLinkMock).not.toHaveBeenCalled();
    expect(addArticleToReadingListMock).not.toHaveBeenCalled();
  });

  it("routes native-menu share events through the selected article URL", () => {
    renderArticleActions(article);

    window.dispatchEvent(new Event(keyboardEvents.openExternalBrowser));
    window.dispatchEvent(new Event(keyboardEvents.copyLink));
    window.dispatchEvent(new Event(keyboardEvents.addToReadingList));

    expect(openArticleInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/article", expect.any(Function));
    expect(copyArticleLinkMock).toHaveBeenCalledWith("https://example.com/article", expect.any(Object));
    expect(addArticleToReadingListMock).toHaveBeenCalledWith("https://example.com/article", expect.any(Object));
  });
});
