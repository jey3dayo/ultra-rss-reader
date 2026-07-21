import { describe, expect, it } from "vitest";
import { resolveArticleListItemPresentation } from "@/lib/articles/article-list-item-presentation";

function buildPresentation(summary: string | null | undefined) {
  return resolveArticleListItemPresentation({
    title: "Article title",
    summary,
    thumbnail: null,
    feedName: "Example Feed",
    viewedAtLabel: null,
    isRead: false,
    isStarred: false,
    isRecentlyRead: false,
    textPreview: "true",
    imagePreviews: "off",
    unreadSuffix: "unread",
    starredSuffix: "starred",
  });
}

describe("resolveArticleListItemPresentation preview noise", () => {
  it("strips a leading bulletin-board post header before the preview text", () => {
    const presentation = buildPresentation("1 名前：Anonymous@2026/07/21(火) ID:abcd1234.net このニュースはすごい");

    expect(presentation.normalizedSummary).toBe("このニュースはすごい");
  });

  it("strips bare URL fragments and trailing response IDs from the preview text", () => {
    const presentation = buildPresentation("普通の要約テキストです http://example.com/foo ID:xxxx1234.net 続き");

    expect(presentation.normalizedSummary).toBe("普通の要約テキストです 続き");
  });

  it("leaves ordinary summary text unchanged", () => {
    const presentation = buildPresentation("普通の要約 これは正常な文章です。");

    expect(presentation.normalizedSummary).toBe("普通の要約 これは正常な文章です。");
  });

  it("does not strip an ordinary numbered sentence that lacks a board-style ID marker", () => {
    const presentation = buildPresentation("1位を獲得しました");

    expect(presentation.normalizedSummary).toBe("1位を獲得しました");
  });
});
