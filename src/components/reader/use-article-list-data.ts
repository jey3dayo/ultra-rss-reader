import { useMemo } from "react";
import {
  buildArticleListFeedNameMap,
  buildFolderFeedIdSet,
  groupArticles,
  resolveArticleListEffectiveViewMode,
  resolveEffectiveRetainedArticleIds,
  selectVisibleArticles,
} from "@/lib/article-list";
import type { UseArticleListDataParams, UseArticleListDataResult } from "./article-list.types";

export function useArticleListData({
  selection,
  feedId,
  folderId,
  tagId,
  smartViewKind,
  accountListScopeId,
  viewMode,
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
  const effectiveViewMode = useMemo<"all" | "unread" | "starred">(() => {
    return resolveArticleListEffectiveViewMode(smartViewKind, viewMode);
  }, [smartViewKind, viewMode]);

  const effectiveRetainedArticleIds = useMemo(() => {
    return resolveEffectiveRetainedArticleIds({
      selection,
      effectiveViewMode,
      retainedArticleIds,
      selectedArticleId,
    });
  }, [effectiveViewMode, retainedArticleIds, selectedArticleId, selection]);

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
      folderFeedIds,
      viewMode: effectiveViewMode,
      smartViewKind,
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
    smartViewKind,
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
