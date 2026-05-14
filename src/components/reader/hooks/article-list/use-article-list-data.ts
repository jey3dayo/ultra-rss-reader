import { useMemo } from "react";
import {
  buildArticleListFeedNameMap,
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
  const feedUrlById = new Map((feeds ?? []).map((feed) => [feed.id, feed.url]));

  return {
    feedId,
    tagId,
    accountListScopeId,
    effectiveViewMode,
    feedNameMap,
    filteredArticles,
    groupedArticles,
    selectedFeed,
    feedUrlById,
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
  const feedUrlById = useMemo(() => new Map((feeds ?? []).map((feed) => [feed.id, feed.url])), [feeds]);

  return {
    feedId,
    tagId,
    accountListScopeId,
    effectiveViewMode,
    feedNameMap,
    filteredArticles,
    groupedArticles,
    selectedFeed,
    feedUrlById,
  };
}
