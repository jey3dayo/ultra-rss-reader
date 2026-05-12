import { describe, expect, it } from "vitest";
import {
  addRetainedArticle,
  getRetainedArticleIdsAfterSelectingArticle,
  MAX_RETAINED_ARTICLE_IDS,
} from "@/lib/articles/article-retention";
import { resolveSubscriptionCleanupRecommendation } from "@/lib/subscriptions/subscription-review-candidates";

describe("article retention", () => {
  it("retains the selected article in unread mode before auto-read can refetch it away", () => {
    const retainedArticleIds = getRetainedArticleIdsAfterSelectingArticle({
      articleId: "art-1",
      viewMode: "unread",
      currentRetainedArticleIds: new Set(),
    });

    expect(retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("keeps previously read articles visible when selecting another article in unread mode", () => {
    const retainedArticleIds = getRetainedArticleIdsAfterSelectingArticle({
      articleId: "art-2",
      viewMode: "unread",
      currentRetainedArticleIds: new Set(["art-1"]),
    });

    expect(retainedArticleIds).toEqual(new Set(["art-1", "art-2"]));
  });

  it("keeps an explicitly retained article visible outside unread mode only while it remains selected", () => {
    const retainedArticleIds = getRetainedArticleIdsAfterSelectingArticle({
      articleId: "art-1",
      viewMode: "all",
      currentRetainedArticleIds: new Set(["art-1"]),
    });

    expect(retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("does not change retained articles when selecting in all mode", () => {
    const retainedArticleIds = getRetainedArticleIdsAfterSelectingArticle({
      articleId: "art-2",
      viewMode: "all",
      currentRetainedArticleIds: new Set(["art-1"]),
    });

    expect(retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("adds explicitly retained articles without mutating the previous set", () => {
    const previousRetainedArticleIds = new Set(["art-1"]);
    const retainedArticleIds = addRetainedArticle(previousRetainedArticleIds, "art-2");

    expect(previousRetainedArticleIds).toEqual(new Set(["art-1"]));
    expect(retainedArticleIds).toEqual(new Set(["art-1", "art-2"]));
  });

  it("ignores blank article ids when selecting in unread mode", () => {
    const retainedArticleIds = getRetainedArticleIdsAfterSelectingArticle({
      articleId: "   ",
      viewMode: "unread",
      currentRetainedArticleIds: new Set(["art-1"]),
    });

    expect(retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("ignores blank or whitespace article ids when adding retained articles directly", () => {
    const previousRetainedArticleIds = new Set(["art-1"]);
    const retainedArticleIds = addRetainedArticle(previousRetainedArticleIds, "   ");

    expect(previousRetainedArticleIds).toEqual(new Set(["art-1"]));
    expect(retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("caps retained article ids to the newest selected articles", () => {
    const retainedArticleIds = Array.from({ length: MAX_RETAINED_ARTICLE_IDS + 2 }, (_, index) => `art-${index}`);

    const result = addRetainedArticle(new Set(retainedArticleIds.slice(0, -1)), retainedArticleIds.at(-1) ?? "");

    expect(result).toHaveLength(MAX_RETAINED_ARTICLE_IDS);
    expect([...result]).toEqual(retainedArticleIds.slice(2));
  });

  it("applies the same size cap when selecting unread articles", () => {
    const retainedArticleIds = Array.from({ length: MAX_RETAINED_ARTICLE_IDS + 2 }, (_, index) => `art-${index}`);

    const result = getRetainedArticleIdsAfterSelectingArticle({
      articleId: retainedArticleIds.at(-1) ?? "",
      viewMode: "unread",
      currentRetainedArticleIds: new Set(retainedArticleIds.slice(0, -1)),
    });

    expect(result).toHaveLength(MAX_RETAINED_ARTICLE_IDS);
    expect([...result]).toEqual(retainedArticleIds.slice(2));
  });

  it("keeps selected unread article retention separate from cleanup recommendation policy", () => {
    const retainedArticleIds = getRetainedArticleIdsAfterSelectingArticle({
      articleId: "art-active",
      viewMode: "unread",
      currentRetainedArticleIds: new Set(),
    });

    const cleanupRecommendation = resolveSubscriptionCleanupRecommendation({
      feedId: "feed-stale",
      title: "Stale Feed",
      folderId: null,
      folderName: null,
      latestArticleAt: "2026-01-01T00:00:00Z",
      staleDays: 94,
      unreadCount: 0,
      starredCount: 1,
      reasonKeys: ["stale_90d", "no_unread"],
    });

    expect(retainedArticleIds).toEqual(new Set(["art-active"]));
    expect(cleanupRecommendation).toBe("cleanup_candidate");
  });
});
