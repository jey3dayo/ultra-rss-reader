import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import type { UseArticleListDataParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { buildArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import { type ReaderFilter, type ReaderSourcePlan, resolveReaderSourcePlan } from "@/lib/reader/reader-query";

const EMPTY_ARTICLES: ArticleDto[] = [];
const EMPTY_RETAINED_ARTICLE_IDS = new Set<string>();

function buildSourcePlan(params: { accountId: string; filter: ReaderFilter }): ReaderSourcePlan {
  return resolveReaderSourcePlan({ type: "all" }, params.filter, params.accountId);
}

function buildParams(sourcePlan: ReaderSourcePlan): UseArticleListDataParams {
  return {
    feedId: null,
    folderId: null,
    tagId: null,
    sourcePlan,
    accountListScopeId: sourcePlan.sourceKey,
    selectedArticleId: null,
    retainedArticleIds: EMPTY_RETAINED_ARTICLE_IDS,
    feeds: sampleFeeds,
    articles: EMPTY_ARTICLES,
    accountArticles: sampleArticles,
    tagArticles: EMPTY_ARTICLES,
    searchResults: EMPTY_ARTICLES,
    showSearch: false,
    trimmedDebouncedQuery: "",
    sortUnread: "newest_first",
    groupBy: "none",
  };
}

describe("buildArticleListData", () => {
  it("does not reuse source articles as search results while current search data is unavailable", () => {
    const sourcePlan = buildSourcePlan({
      accountId: "acc-1",
      filter: "all",
    });

    const result = buildArticleListData({
      ...buildParams(sourcePlan),
      showSearch: true,
      trimmedDebouncedQuery: "urgent",
      searchResults: undefined,
    });

    expect(result.filteredArticles).toEqual([]);
  });
});
