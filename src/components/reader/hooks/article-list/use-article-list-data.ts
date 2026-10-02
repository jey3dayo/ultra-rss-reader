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
  source: { sourcePlan, feeds, articles },
  selectedArticleId,
  retainedArticleIds,
  searchResults,
  showSearch,
  trimmedDebouncedQuery,
  sortUnread,
  groupBy,
}: UseArticleListDataParams): UseArticleListDataResult {
  const { feedId, folderId, tagId } = sourcePlan;
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
    effectiveViewMode,
    feedNameMap,
    filteredArticles,
    groupedArticles,
    selectedFeed,
  };
}

export function useArticleListData(params: UseArticleListDataParams): UseArticleListDataResult {
  const {
    source: { sourcePlan, feeds, articles },
    selectedArticleId,
    retainedArticleIds,
    searchResults,
    showSearch,
    trimmedDebouncedQuery,
    sortUnread,
    groupBy,
  } = params;
  // Source objects may be recreated for loading or paging updates without changing
  // the list. Only the plan content and article/feed references invalidate filtering.
  const sourcePlanRef = useRef(sourcePlan);
  if (buildArticleListSourcePlanKey(sourcePlanRef.current) !== buildArticleListSourcePlanKey(sourcePlan)) {
    sourcePlanRef.current = sourcePlan;
  }
  const stableSourcePlan = sourcePlanRef.current;

  return useMemo(
    () =>
      buildArticleListData({
        source: { sourcePlan: stableSourcePlan, feeds, articles },
        selectedArticleId,
        retainedArticleIds,
        searchResults,
        showSearch,
        trimmedDebouncedQuery,
        sortUnread,
        groupBy,
      }),
    [
      stableSourcePlan,
      selectedArticleId,
      retainedArticleIds,
      feeds,
      articles,
      searchResults,
      showSearch,
      trimmedDebouncedQuery,
      sortUnread,
      groupBy,
    ],
  );
}
