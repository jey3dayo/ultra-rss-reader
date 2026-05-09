import { describe, expect, it } from "vitest";
import { addRetainedArticle, getRetainedArticleIdsAfterSelectingArticle } from "@/lib/articles/article-retention";

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

  it("ignores blank article ids when adding retained articles directly", () => {
    const previousRetainedArticleIds = new Set(["art-1"]);
    const retainedArticleIds = addRetainedArticle(previousRetainedArticleIds, "");

    expect(previousRetainedArticleIds).toEqual(new Set(["art-1"]));
    expect(retainedArticleIds).toEqual(new Set(["art-1"]));
  });
});
