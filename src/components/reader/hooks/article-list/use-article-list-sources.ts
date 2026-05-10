import { useEffect, useMemo, useState } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useAccountArticles, useArticles, useFolderArticles, useRecentArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { adoptSnapshotByKey, useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { useArticlesByTag, useTags } from "@/hooks/use-tags";
import {
  collectRetainedArticlesFromSources,
  mergeResolvedArticlesWithRetained,
  mergeRetainedArticlesSnapshot,
  type RetainedArticlesSnapshot,
} from "@/lib/articles/article-list";
import {
  type ReaderSelectionAvailability,
  type ReaderSourceKind,
  resolveReaderSourcePlan,
  shouldRecoverUnavailableReaderSelection,
} from "@/lib/reader/reader-query";
import { useUiStore } from "@/stores/ui-store";
import type { UseArticleListSourcesParams, UseArticleListSourcesResult } from "../../article-list.types";

type ArticleListPrimarySourceSnapshot = {
  contextKey: string;
  articles: ArticleDto[] | undefined;
};

function resolveLatestFeedsForAccount(feeds: FeedDto[] | undefined, selectedAccountId: string | null) {
  if (feeds === undefined || selectedAccountId === null) {
    return feeds;
  }

  return feeds.filter((feed) => feed.account_id === selectedAccountId);
}

function resolveLatestFeedArticles(articles: ArticleDto[] | undefined, feedId: string | null) {
  if (articles === undefined || feedId === null) {
    return articles;
  }

  return articles.every((article) => article.feed_id === feedId) ? articles : undefined;
}

function resolveLatestAccountArticles(params: {
  articles: ArticleDto[] | undefined;
  sourceKind: ReaderSourceKind;
  feeds: FeedDto[] | undefined;
}) {
  const { articles, sourceKind, feeds } = params;
  if (articles === undefined || sourceKind === "feed" || sourceKind === "tag") {
    return articles;
  }

  if (feeds === undefined) {
    return undefined;
  }

  const feedIds = new Set(feeds.map((feed) => feed.id));
  return articles.filter((article) => feedIds.has(article.feed_id));
}

function recoverStaleReaderSelection(selection: UseArticleListSourcesParams["selection"]): void {
  const currentSelection = useUiStore.getState().selection;

  switch (selection.type) {
    case "feed":
      if (currentSelection.type !== "feed" || currentSelection.feedId !== selection.feedId) {
        return;
      }
      break;
    case "folder":
      if (currentSelection.type !== "folder" || currentSelection.folderId !== selection.folderId) {
        return;
      }
      break;
    case "tag":
      if (currentSelection.type !== "tag" || currentSelection.tagId !== selection.tagId) {
        return;
      }
      break;
    default:
      return;
  }

  useUiStore.getState().selectAll();
}

function resolvePrimarySourceArticles(params: {
  sourceKind: ReaderSourceKind;
  articles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
  folderArticles: ArticleDto[] | undefined;
  accountSelectionArticles: ArticleDto[] | undefined;
}): ArticleDto[] | undefined {
  const { sourceKind, articles, tagArticles, folderArticles, accountSelectionArticles } = params;

  if (sourceKind === "feed") {
    return articles;
  }

  if (sourceKind === "tag") {
    return tagArticles;
  }

  if (sourceKind === "folder") {
    return folderArticles;
  }

  return accountSelectionArticles;
}

function resolvePrimarySourceLoading(params: {
  sourceKind: ReaderSourceKind;
  isLoadingFeedArticles: boolean;
  isLoadingTagArticles: boolean;
  isLoadingFolderArticles: boolean;
  isLoadingRecentArticles: boolean;
  isLoadingAccountArticles: boolean;
}): boolean {
  const {
    sourceKind,
    isLoadingFeedArticles,
    isLoadingTagArticles,
    isLoadingFolderArticles,
    isLoadingRecentArticles,
    isLoadingAccountArticles,
  } = params;

  if (sourceKind === "feed") {
    return isLoadingFeedArticles;
  }

  if (sourceKind === "tag") {
    return isLoadingTagArticles;
  }

  if (sourceKind === "folder") {
    return isLoadingFolderArticles;
  }

  if (sourceKind === "recent") {
    return isLoadingRecentArticles;
  }

  return isLoadingAccountArticles;
}

export function useArticleListSources({
  selection,
  selectedAccountId,
  retainedArticleIds,
  viewMode,
}: UseArticleListSourcesParams): UseArticleListSourcesResult {
  const sourcePlan = resolveReaderSourcePlan(selection, viewMode, selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: allFeedArticles } = useArticles(sourcePlan.feedId, {
    mode: "all",
  });
  const { data: articles, isLoading: isLoadingFeedArticles } = useArticles(sourcePlan.feedId, {
    mode: sourcePlan.feedMode,
  });
  const { data: allAccountArticles } = useAccountArticles(sourcePlan.accountId, { mode: "all" });
  const { data: accountArticles, isLoading: isLoadingAccountArticles } = useAccountArticles(sourcePlan.accountId, {
    mode: sourcePlan.accountMode,
  });
  const { data: folderArticles, isLoading: isLoadingFolderArticles } = useFolderArticles(sourcePlan.folderId, {
    mode: sourcePlan.folderMode,
  });
  const { data: recentArticles, isLoading: isLoadingRecentArticles } = useRecentArticles(
    sourcePlan.sourceKind === "recent" ? sourcePlan.accountId : null,
    {
      mode: sourcePlan.recentMode,
    },
  );
  const { data: tagArticles, isLoading: isLoadingTagArticles } = useArticlesByTag(sourcePlan.tagId, selectedAccountId, {
    mode: sourcePlan.tagMode,
  });
  const latestFeeds = useMemo(() => resolveLatestFeedsForAccount(feeds, selectedAccountId), [feeds, selectedAccountId]);
  const latestFeedArticles = useMemo(
    () => resolveLatestFeedArticles(articles, sourcePlan.feedId),
    [articles, sourcePlan.feedId],
  );
  const latestAllFeedArticles = useMemo(
    () => resolveLatestFeedArticles(allFeedArticles, sourcePlan.feedId),
    [allFeedArticles, sourcePlan.feedId],
  );
  const latestAccountArticles = useMemo(
    () =>
      resolveLatestAccountArticles({
        articles: accountArticles,
        sourceKind: sourcePlan.sourceKind,
        feeds: latestFeeds,
      }),
    [accountArticles, latestFeeds, sourcePlan.sourceKind],
  );
  const latestAllAccountArticles = useMemo(
    () =>
      resolveLatestAccountArticles({
        articles: allAccountArticles,
        sourceKind: sourcePlan.sourceKind,
        feeds: latestFeeds,
      }),
    [allAccountArticles, latestFeeds, sourcePlan.sourceKind],
  );
  const latestRecentArticles = useMemo(
    () =>
      resolveLatestAccountArticles({
        articles: recentArticles,
        sourceKind: sourcePlan.sourceKind,
        feeds: latestFeeds,
      }),
    [latestFeeds, recentArticles, sourcePlan.sourceKind],
  );
  const latestFolderArticles = useMemo(
    () =>
      resolveLatestAccountArticles({
        articles: folderArticles,
        sourceKind: sourcePlan.sourceKind,
        feeds: latestFeeds,
      }),
    [folderArticles, latestFeeds, sourcePlan.sourceKind],
  );
  const feedsSnapshotCandidate = useMemo(
    () =>
      selectedAccountId !== null && latestFeeds !== undefined
        ? { accountId: selectedAccountId, feeds: latestFeeds }
        : null,
    [latestFeeds, selectedAccountId],
  );
  const { snapshot: feedsSnapshot } = useScreenSnapshot(feedsSnapshotCandidate, feedsSnapshotCandidate !== null);
  const adoptedFeedsSnapshot = adoptSnapshotByKey(feedsSnapshot, "accountId", selectedAccountId);
  const resolvedFeeds = adoptedFeedsSnapshot?.feeds ?? latestFeeds;

  useEffect(() => {
    const selectedSourceHasLoadedArticles =
      (selection.type === "feed" && latestFeedArticles !== undefined && latestFeedArticles.length > 0) ||
      (selection.type === "folder" && latestFolderArticles !== undefined && latestFolderArticles.length > 0) ||
      (selection.type === "tag" && tagArticles !== undefined && tagArticles.length > 0);
    const selectedSourceIsLoading =
      (selection.type === "feed" && isLoadingFeedArticles) ||
      (selection.type === "folder" && isLoadingFolderArticles) ||
      (selection.type === "tag" && isLoadingTagArticles);
    if (selectedSourceIsLoading || selectedSourceHasLoadedArticles) {
      return;
    }

    const folderIds =
      folders !== undefined
        ? new Set([
            ...folders.map((folder) => folder.id),
            ...(latestFeeds ?? []).flatMap((feed) => (feed.folder_id ? [feed.folder_id] : [])),
          ])
        : undefined;
    const availability: ReaderSelectionAvailability = {
      ...(latestFeeds !== undefined ? { feedIds: new Set(latestFeeds.map((feed) => feed.id)) } : {}),
      ...(folderIds !== undefined ? { folderIds } : {}),
      ...(tags !== undefined ? { tagIds: new Set(tags.map((tag) => tag.id)) } : {}),
    };
    if (shouldRecoverUnavailableReaderSelection(selection, availability)) {
      recoverStaleReaderSelection(selection);
    }
  }, [
    folders,
    isLoadingFeedArticles,
    isLoadingFolderArticles,
    isLoadingTagArticles,
    latestFeedArticles,
    latestFeeds,
    latestFolderArticles,
    selection,
    tagArticles,
    tags,
  ]);

  const accountSelectionArticles = sourcePlan.sourceKind === "recent" ? latestRecentArticles : latestAccountArticles;
  const primarySourceArticles = resolvePrimarySourceArticles({
    sourceKind: sourcePlan.sourceKind,
    articles: latestFeedArticles,
    tagArticles,
    folderArticles: latestFolderArticles,
    accountSelectionArticles,
  });
  const primarySourceLoading = resolvePrimarySourceLoading({
    sourceKind: sourcePlan.sourceKind,
    isLoadingFeedArticles,
    isLoadingTagArticles,
    isLoadingFolderArticles,
    isLoadingRecentArticles,
    isLoadingAccountArticles,
  });
  const primarySourceSnapshotCandidate = useMemo<ArticleListPrimarySourceSnapshot | null>(
    () =>
      primarySourceArticles === undefined
        ? null
        : {
            contextKey: sourcePlan.sourceKey,
            articles: primarySourceArticles,
          },
    [primarySourceArticles, sourcePlan.sourceKey],
  );
  const { snapshot: primarySourceSnapshot } = useScreenSnapshot(
    primarySourceSnapshotCandidate,
    primarySourceSnapshotCandidate !== null,
  );
  const adoptedPrimarySourceSnapshot = adoptSnapshotByKey(primarySourceSnapshot, "contextKey", sourcePlan.sourceKey);
  const resolvedPrimarySourceArticles = adoptedPrimarySourceSnapshot?.articles ?? primarySourceArticles;
  const currentRetainedArticles = useMemo(() => {
    return collectRetainedArticlesFromSources({
      retainedArticleIds,
      sources: [
        primarySourceArticles,
        latestAccountArticles,
        latestFolderArticles,
        latestRecentArticles,
        latestFeedArticles,
        latestAllFeedArticles,
        latestAllAccountArticles,
        tagArticles,
      ],
    });
  }, [
    latestAccountArticles,
    latestFeedArticles,
    latestAllFeedArticles,
    latestAllAccountArticles,
    latestFolderArticles,
    primarySourceArticles,
    latestRecentArticles,
    retainedArticleIds,
    tagArticles,
  ]);
  const [retainedArticlesSnapshot, setRetainedArticlesSnapshot] = useState<RetainedArticlesSnapshot | null>(null);

  useEffect(() => {
    if (retainedArticleIds.size === 0) {
      setRetainedArticlesSnapshot(null);
      return;
    }

    setRetainedArticlesSnapshot((previous) => {
      return mergeRetainedArticlesSnapshot({
        previous,
        contextKey: sourcePlan.sourceKey,
        retainedArticleIds,
        currentRetainedArticles,
      });
    });
  }, [currentRetainedArticles, retainedArticleIds, sourcePlan.sourceKey]);
  const resolvedPrimarySourceArticlesWithRetained = useMemo(() => {
    return mergeResolvedArticlesWithRetained({
      resolvedPrimarySourceArticles,
      retainedArticlesSnapshot,
      retainedArticleIds,
      contextKey: sourcePlan.sourceKey,
    });
  }, [resolvedPrimarySourceArticles, retainedArticleIds, retainedArticlesSnapshot, sourcePlan.sourceKey]);
  const isPrimarySourceLoading = primarySourceLoading && adoptedPrimarySourceSnapshot === null;

  return {
    feedId: sourcePlan.feedId,
    folderId: sourcePlan.folderId,
    tagId: sourcePlan.tagId,
    sourcePlan,
    accountListScopeId:
      sourcePlan.sourceKind === "account" || sourcePlan.sourceKind === "folder" || sourcePlan.sourceKind === "recent"
        ? sourcePlan.sourceKey
        : null,
    feeds: resolvedFeeds,
    articles: sourcePlan.sourceKind === "feed" ? resolvedPrimarySourceArticlesWithRetained : latestFeedArticles,
    accountArticles:
      sourcePlan.sourceKind === "account" || sourcePlan.sourceKind === "folder" || sourcePlan.sourceKind === "recent"
        ? resolvedPrimarySourceArticlesWithRetained
        : latestAccountArticles,
    tagArticles: sourcePlan.sourceKind === "tag" ? resolvedPrimarySourceArticlesWithRetained : tagArticles,
    isLoadingFeedArticles: sourcePlan.sourceKind === "feed" ? isPrimarySourceLoading : isLoadingFeedArticles,
    isLoadingAccountArticles: sourcePlan.sourceKind === "account" ? isPrimarySourceLoading : isLoadingAccountArticles,
    isLoadingFolderArticles: sourcePlan.sourceKind === "folder" ? isPrimarySourceLoading : isLoadingFolderArticles,
    isLoadingRecentArticles: sourcePlan.sourceKind === "recent" ? isPrimarySourceLoading : isLoadingRecentArticles,
    isLoadingTagArticles: sourcePlan.sourceKind === "tag" ? isPrimarySourceLoading : isLoadingTagArticles,
  };
}
