import { renderHook } from "@testing-library/react";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import type { UseArticleListDataParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { useArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import type { ReaderFilter, ReaderSourcePlan } from "@/lib/reader/reader-query";

const EMPTY_ARTICLES: ArticleDto[] = [];
const EMPTY_RETAINED_ARTICLE_IDS = new Set<string>();

function buildSourcePlan(params: {
  accountId: string;
  filter: ReaderFilter;
  effectiveViewMode: ReaderFilter;
}): ReaderSourcePlan {
  return {
    query: {
      source: "articles",
      scope: { type: "account", accountId: params.accountId },
      filter: params.filter,
    },
    sourceKind: "account",
    sourceKey: `account:${params.accountId}:articles:${params.filter}`,
    accountId: params.accountId,
    folderId: null,
    feedId: null,
    tagId: null,
    accountMode: params.filter,
    folderMode: "all",
    feedMode: "all",
    tagMode: "all",
    recentMode: "all",
    effectiveViewMode: params.effectiveViewMode,
    preservesRecentOrder: false,
  };
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

describe("useArticleListData", () => {
  it("keeps filtered article memo stable when an equivalent sourcePlan object is recreated", () => {
    const firstPlan = buildSourcePlan({
      accountId: "acc-1",
      filter: "all",
      effectiveViewMode: "all",
    });
    const { result, rerender } = renderHook(
      ({ params }: { params: UseArticleListDataParams }) => useArticleListData(params),
      {
        initialProps: { params: buildParams(firstPlan) },
      },
    );
    const firstFilteredArticles = result.current.filteredArticles;

    rerender({
      params: buildParams(
        buildSourcePlan({
          accountId: "acc-1",
          filter: "all",
          effectiveViewMode: "all",
        }),
      ),
    });

    expect(result.current.filteredArticles).toBe(firstFilteredArticles);

    rerender({
      params: buildParams(
        buildSourcePlan({
          accountId: "acc-1",
          filter: "unread",
          effectiveViewMode: "unread",
        }),
      ),
    });

    expect(result.current.filteredArticles).not.toBe(firstFilteredArticles);
  });

  it("does not reuse source articles as search results while current search data is unavailable", () => {
    const sourcePlan = buildSourcePlan({
      accountId: "acc-1",
      filter: "all",
      effectiveViewMode: "all",
    });
    const { result } = renderHook(() =>
      useArticleListData({
        ...buildParams(sourcePlan),
        showSearch: true,
        trimmedDebouncedQuery: "urgent",
        searchResults: undefined,
      }),
    );

    expect(result.current.filteredArticles).toEqual([]);
  });
});
