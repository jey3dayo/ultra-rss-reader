import { renderHook } from "@testing-library/react";
import { buildArticleListDataParams, buildArticleListDataSourcePlan } from "@tests/helpers/article-list-data-params";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import type { UseArticleListDataParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { useArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import { resolveReaderSourcePlan } from "@/lib/reader/reader-query";

setupBrowserTestDom();

describe("useArticleListData", () => {
  it("keeps filtered article memo stable when an equivalent sourcePlan object is recreated", () => {
    const firstPlan = buildArticleListDataSourcePlan({
      accountId: "acc-1",
      filter: "all",
    });
    const { result, rerender } = renderHook(
      ({ params }: { params: UseArticleListDataParams }) => useArticleListData(params),
      {
        initialProps: { params: buildArticleListDataParams(firstPlan) },
      },
    );
    const firstFilteredArticles = result.current.filteredArticles;

    rerender({
      params: buildArticleListDataParams(
        buildArticleListDataSourcePlan({
          accountId: "acc-1",
          filter: "all",
        }),
      ),
    });

    expect(result.current.filteredArticles).toBe(firstFilteredArticles);

    rerender({
      params: buildArticleListDataParams(
        buildArticleListDataSourcePlan({
          accountId: "acc-1",
          filter: "unread",
        }),
      ),
    });

    expect(result.current.filteredArticles).not.toBe(firstFilteredArticles);
  });

  it("ignores source loading and paging changes but invalidates filtering on a scope change", () => {
    const params = buildArticleListDataParams(buildArticleListDataSourcePlan({ accountId: "acc-1", filter: "all" }));
    const initialSource = { ...params.source, isLoadingArticles: false, hasNextPage: false, isFetchingNextPage: false };
    const { result, rerender } = renderHook(({ source }) => useArticleListData({ ...params, source }), {
      initialProps: { source: initialSource },
    });
    const firstFiltered = result.current.filteredArticles;

    rerender({ source: { ...initialSource, isLoadingArticles: true, hasNextPage: true, isFetchingNextPage: true } });
    expect(result.current.filteredArticles).toBe(firstFiltered);

    rerender({
      source: {
        ...initialSource,
        sourcePlan: resolveReaderSourcePlan({ type: "feed", feedId: "feed-1" }, "all", "acc-1"),
      },
    });
    expect(result.current.filteredArticles).not.toBe(firstFiltered);
    expect(result.current.filteredArticles.map((article) => article.id)).toEqual(["art-1", "art-2"]);
  });
});
