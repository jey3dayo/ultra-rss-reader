import { useMemo } from "react";
import {
  buildArticleListFeedNameMap,
  buildFolderFeedIdSet,
  groupArticles,
  resolveEffectiveRetainedArticleIds,
  selectVisibleArticles,
} from "@/lib/articles/article-list";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { UseArticleListDataParams, UseArticleListDataResult } from "../../article-list.types";

export function useArticleListData({
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
  const effectiveViewMode = useMemo<ViewMode>(() => {
    return sourcePlan.effectiveViewMode;
  }, [sourcePlan.effectiveViewMode]);

  const effectiveRetainedArticleIds = useMemo(() => {
    return resolveEffectiveRetainedArticleIds({
      sourceFilter,
      effectiveViewMode,
      retainedArticleIds,
      selectedArticleId,
    });
  }, [effectiveViewMode, retainedArticleIds, selectedArticleId, sourceFilter]);

  const feedNameMap = useMemo(() => {
    return buildArticleListFeedNameMap(feeds);
  }, [feeds]);

  const folderFeedIds = useMemo(() => {
    return buildFolderFeedIdSet(feeds, folderId);
  }, [feeds, folderId]);

  const filteredArticles = useMemo(() => {
    return selectVisibleArticles({
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
  }, [
    effectiveRetainedArticleIds,
    accountArticles,
    articles,
    feedId,
    folderFeedIds,
    tagArticles,
    tagId,
    effectiveViewMode,
    sourceFilter,
    sourcePlan.preservesRecentOrder,
    showSearch,
    trimmedDebouncedQuery,
    searchResults,
    sortUnread,
  ]);

  const groupedArticles = useMemo(() => {
    return groupArticles({
      articles: filteredArticles,
      groupBy,
      feedNameMap,
    });
  }, [filteredArticles, groupBy, feedNameMap]);

  const selectedFeed = useMemo(() => feeds?.find((feed) => feed.id === feedId), [feeds, feedId]);

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
