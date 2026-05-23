import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import type { ArticleDto } from "@/api/tauri-commands";
import type { UseArticleListDataParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import { type ReaderFilter, type ReaderSourcePlan, resolveReaderSourcePlan } from "@/lib/reader/reader-query";

const EMPTY_ARTICLES: ArticleDto[] = [];
const EMPTY_RETAINED_ARTICLE_IDS = new Set<string>();

export function buildArticleListDataSourcePlan(params: { accountId: string; filter: ReaderFilter }): ReaderSourcePlan {
  return resolveReaderSourcePlan({ type: "all" }, params.filter, params.accountId);
}

export function buildArticleListDataParams(sourcePlan: ReaderSourcePlan): UseArticleListDataParams {
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
