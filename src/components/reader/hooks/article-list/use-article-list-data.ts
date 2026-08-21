import { useMemo, useRef } from "react";
import {
  buildArticleListFeedNameMap,
  buildArticleListSourcePlanKey,
  buildFolderFeedIdSet,
  groupArticles,
  resolveEffectiveRetainedArticleIds,
  selectVisibleArticles,
} from "@/lib/articles/article-list";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { UseArticleListDataParams, UseArticleListDataResult } from "./article-list-controller.types";

export function buildArticleListData({
  feedId,
  folderId,
  tagId,
  sourcePlan,
  accountListScopeId,
  selectedArticleId,
  retainedArticleIds,
  feeds,
  articles,
  accountArticles,
  tagArticles,
  searchResults,
  showSearch,
  trimmedDebouncedQuery,
  sortUnread,
  groupBy,
}: UseArticleListDataParams): UseArticleListDataResult {
  const sourceFilter = sourcePlan.query?.filter ?? null;
  const effectiveViewMode: ViewMode = sourcePlan.effectiveViewMode;
  const effectiveRetainedArticleIds = resolveEffectiveRetainedArticleIds({
    sourceFilter,
    effectiveViewMode,
    retainedArticleIds,
    selectedArticleId,
  });
  const feedNameMap = buildArticleListFeedNameMap(feeds);
  const folderFeedIds = buildFolderFeedIdSet(feeds, folderId);
  const filteredArticles = selectVisibleArticles({
    articles,
    accountArticles,
    tagArticles,
    searchResults,
    feedId,
    tagId,
    folderFeedIds: showSearch ? folderFeedIds : null,
    viewMode: effectiveViewMode,
    sourceFilter,
    preservesSourceOrder: sourcePlan.preservesRecentOrder,
    showSearch,
    searchQuery: trimmedDebouncedQuery,
    sortUnread,
    retainedArticleIds: effectiveRetainedArticleIds,
  });
  const groupedArticles = groupArticles({
    articles: filteredArticles,
    groupBy,
    feedNameMap,
  });
  const selectedFeed = feeds?.find((feed) => feed.id === feedId);

  return {
    feedId,
    tagId,
    accountListScopeId,
    effectiveViewMode,
    feedNameMap,
    filteredArticles,
    groupedArticles,
    selectedFeed,
  };
}

export function useArticleListData(params: UseArticleListDataParams): UseArticleListDataResult {
  const {
    feedId,
    folderId,
    tagId,
    sourcePlan,
    accountListScopeId,
    selectedArticleId,
    retainedArticleIds,
    feeds,
    articles,
    accountArticles,
    tagArticles,
    searchResults,
    showSearch,
    trimmedDebouncedQuery,
    sortUnread,
    groupBy,
  } = params;
  // `sourcePlan` is recreated on every render by `useArticleListSources`, but its content
  // (not its identity) is what should drive recomputation — see the memo-stability contract
  // pinned by `use-article-list-data.node.test.tsx`. Keep the previous reference as long as
  // `buildArticleListSourcePlanKey` reports the same content so the memo below only sees a
  // changed `sourcePlan` when something it actually reads (source, filter, view mode, order)
  // changed.
  const sourcePlanRef = useRef(sourcePlan);
  if (buildArticleListSourcePlanKey(sourcePlanRef.current) !== buildArticleListSourcePlanKey(sourcePlan)) {
    sourcePlanRef.current = sourcePlan;
  }
  const stableSourcePlan = sourcePlanRef.current;

  // A single `buildArticleListData` call, memoized on its individual scalar/array
  // dependencies, keeps this hook's production behavior identical to the plain function
  // the tests exercise directly. Do not reintroduce a parallel step-by-step recomputation
  // here; that previously let the hook body drift from `buildArticleListData`.
  return useMemo(
    () =>
      buildArticleListData({
        feedId,
        folderId,
        tagId,
        sourcePlan: stableSourcePlan,
        accountListScopeId,
        selectedArticleId,
        retainedArticleIds,
        feeds,
        articles,
        accountArticles,
        tagArticles,
        searchResults,
        showSearch,
        trimmedDebouncedQuery,
        sortUnread,
        groupBy,
      }),
    [
      feedId,
      folderId,
      tagId,
      stableSourcePlan,
      accountListScopeId,
      selectedArticleId,
      retainedArticleIds,
      feeds,
      articles,
      accountArticles,
      tagArticles,
      searchResults,
      showSearch,
      trimmedDebouncedQuery,
      sortUnread,
      groupBy,
    ],
  );
}
