import { useMemo } from "react";
import { groupArticles, selectVisibleArticles } from "@/lib/article-list";
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
    if (smartViewKind === "unread") {
      return "unread";
    }

    if (smartViewKind === "starred") {
      return viewMode === "unread" ? "unread" : "all";
    }

    return viewMode;
  }, [smartViewKind, viewMode]);

  const effectiveRetainedArticleIds = useMemo(() => {
    if (
      selection.type === "smart" &&
      selection.kind === "starred" &&
      effectiveViewMode === "all" &&
      selectedArticleId
    ) {
      return new Set([...retainedArticleIds, selectedArticleId]);
    }

    return retainedArticleIds;
  }, [effectiveViewMode, retainedArticleIds, selectedArticleId, selection]);

  const feedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const feed of feeds ?? []) {
      map.set(feed.id, feed.title);
    }
    return map;
  }, [feeds]);

  const folderFeedIds = useMemo(() => {
    if (!folderId) {
      return null;
    }

    return new Set((feeds ?? []).filter((feed) => feed.folder_id === folderId).map((feed) => feed.id));
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
