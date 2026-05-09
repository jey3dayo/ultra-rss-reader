import { useEffect, useMemo, useState } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
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
  const feedsSnapshotCandidate = useMemo(
    () => (selectedAccountId !== null && feeds !== undefined ? { accountId: selectedAccountId, feeds } : null),
    [feeds, selectedAccountId],
  );
  const { snapshot: feedsSnapshot } = useScreenSnapshot(feedsSnapshotCandidate, feedsSnapshotCandidate !== null);
  const adoptedFeedsSnapshot = adoptSnapshotByKey(feedsSnapshot, "accountId", selectedAccountId);
  const resolvedFeeds = adoptedFeedsSnapshot?.feeds ?? feeds;

  useEffect(() => {
    const availability: ReaderSelectionAvailability = {
      ...(feeds !== undefined ? { feedIds: new Set(feeds.map((feed) => feed.id)) } : {}),
      ...(folders !== undefined ? { folderIds: new Set(folders.map((folder) => folder.id)) } : {}),
      ...(tags !== undefined ? { tagIds: new Set(tags.map((tag) => tag.id)) } : {}),
    };
    if (shouldRecoverUnavailableReaderSelection(selection, availability)) {
      recoverStaleReaderSelection(selection);
    }
  }, [feeds, folders, selection, tags]);

  const accountSelectionArticles = sourcePlan.sourceKind === "recent" ? recentArticles : accountArticles;
  const primarySourceArticles = resolvePrimarySourceArticles({
    sourceKind: sourcePlan.sourceKind,
    articles,
    tagArticles,
    folderArticles,
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
        accountArticles,
        folderArticles,
        recentArticles,
        articles,
        allFeedArticles,
        allAccountArticles,
        tagArticles,
      ],
    });
  }, [
    accountArticles,
    articles,
    allFeedArticles,
    allAccountArticles,
    folderArticles,
    primarySourceArticles,
    recentArticles,
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
    articles: sourcePlan.sourceKind === "feed" ? resolvedPrimarySourceArticlesWithRetained : articles,
    accountArticles:
      sourcePlan.sourceKind === "account" || sourcePlan.sourceKind === "folder" || sourcePlan.sourceKind === "recent"
        ? resolvedPrimarySourceArticlesWithRetained
        : accountArticles,
    tagArticles: sourcePlan.sourceKind === "tag" ? resolvedPrimarySourceArticlesWithRetained : tagArticles,
    isLoadingFeedArticles: sourcePlan.sourceKind === "feed" ? isPrimarySourceLoading : isLoadingFeedArticles,
    isLoadingAccountArticles: sourcePlan.sourceKind === "account" ? isPrimarySourceLoading : isLoadingAccountArticles,
    isLoadingFolderArticles: sourcePlan.sourceKind === "folder" ? isPrimarySourceLoading : isLoadingFolderArticles,
    isLoadingRecentArticles: sourcePlan.sourceKind === "recent" ? isPrimarySourceLoading : isLoadingRecentArticles,
    isLoadingTagArticles: sourcePlan.sourceKind === "tag" ? isPrimarySourceLoading : isLoadingTagArticles,
  };
}
