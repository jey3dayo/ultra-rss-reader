import { renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import type { UseArticleListDataParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { useArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import { type ReaderFilter, type ReaderSourcePlan, resolveReaderSourcePlan } from "@/lib/reader/reader-query";

setupBrowserTestDom();

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

describe("useArticleListData", () => {
  it("keeps filtered article memo stable when an equivalent sourcePlan object is recreated", () => {
    const firstPlan = buildSourcePlan({
      accountId: "acc-1",
      filter: "all",
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
        }),
      ),
    });

    expect(result.current.filteredArticles).toBe(firstFilteredArticles);

    rerender({
      params: buildParams(
        buildSourcePlan({
          accountId: "acc-1",
          filter: "unread",
        }),
      ),
    });

    expect(result.current.filteredArticles).not.toBe(firstFilteredArticles);
  });
});
