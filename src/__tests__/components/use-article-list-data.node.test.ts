import { buildArticleListDataParams, buildArticleListDataSourcePlan } from "@tests/helpers/article-list-data-params";
import { describe, expect, it } from "vitest";
import { buildArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";

describe("buildArticleListData", () => {
  it("does not reuse source articles as search results while current search data is unavailable", () => {
    const sourcePlan = buildArticleListDataSourcePlan({
      accountId: "acc-1",
      filter: "all",
    });

    const result = buildArticleListData({
      ...buildArticleListDataParams(sourcePlan),
      showSearch: true,
      trimmedDebouncedQuery: "urgent",
      searchResults: undefined,
    });

    expect(result.filteredArticles).toEqual([]);
  });
});
