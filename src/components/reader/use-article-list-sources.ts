import { useEffect, useMemo, useState } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { useAccountArticles, useArticles, useRecentArticles, useStarredArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { adoptSnapshotByKey, useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { useArticlesByTag } from "@/hooks/use-tags";
import {
  collectRetainedArticlesFromSources,
  mergeResolvedArticlesWithRetained,
  mergeRetainedArticlesSnapshot,
  type RetainedArticlesSnapshot,
} from "@/lib/article-list";
import type {
  ArticleListPrimarySourceContext,
  ArticleListPrimarySourceSnapshot,
  UseArticleListSourcesParams,
  UseArticleListSourcesResult,
} from "./article-list.types";

function resolvePrimarySourceArticles(params: {
  selectionContext: ArticleListPrimarySourceContext;
  articles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
  accountSelectionArticles: ArticleDto[] | undefined;
}): ArticleDto[] | undefined {
  const { selectionContext, articles, tagArticles, accountSelectionArticles } = params;

  if (selectionContext.kind === "feed") {
    return articles;
  }

  if (selectionContext.kind === "tag") {
    return tagArticles;
  }

  return accountSelectionArticles;
}

function resolvePrimarySourceLoading(params: {
  selectionContext: ArticleListPrimarySourceContext;
  isLoading: boolean;
  isLoadingTagArticles: boolean;
  smartViewKind: "unread" | "starred" | "recent" | null;
  isLoadingStarredArticles: boolean;
  isLoadingRecentArticles: boolean;
  isLoadingAccountArticles: boolean;
}): boolean {
  const {
    selectionContext,
    isLoading,
    isLoadingTagArticles,
    smartViewKind,
    isLoadingStarredArticles,
    isLoadingRecentArticles,
    isLoadingAccountArticles,
  } = params;

  if (selectionContext.kind === "feed") {
    return isLoading;
  }

  if (selectionContext.kind === "tag") {
    return isLoadingTagArticles;
  }

  if (smartViewKind === "starred") {
    return isLoadingStarredArticles;
  }

  if (smartViewKind === "recent") {
    return isLoadingRecentArticles;
  }

  return isLoadingAccountArticles;
}

export function useArticleListSources({
  selection,
  selectionContext,
  selectedAccountId,
  retainedArticleIds,
  viewMode,
}: UseArticleListSourcesParams): UseArticleListSourcesResult {
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const folderId = selection.type === "folder" ? selection.folderId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const smartViewKind = selection.type === "smart" ? selection.kind : null;
  const accountListScopeId = feedId || tagId ? null : selectedAccountId;
  const unreadOnlyForFeed = smartViewKind !== "starred" && viewMode === "unread";
  const unreadOnlyForAccount = smartViewKind === "unread" || (smartViewKind !== "starred" && viewMode === "unread");
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: allFeedArticles } = useArticles(feedId);
  const { data: articles, isLoading } = useArticles(feedId, { unreadOnly: unreadOnlyForFeed });
  const { data: allAccountArticles } = useAccountArticles(accountListScopeId);
  const { data: accountArticles, isLoading: isLoadingAccountArticles } = useAccountArticles(accountListScopeId, {
    unreadOnly: unreadOnlyForAccount,
  });
  const { data: starredArticles, isLoading: isLoadingStarredArticles } = useStarredArticles(
    smartViewKind === "starred" ? accountListScopeId : null,
  );
  const { data: recentArticles, isLoading: isLoadingRecentArticles } = useRecentArticles(
    smartViewKind === "recent" ? accountListScopeId : null,
  );
  const { data: tagArticles, isLoading: isLoadingTagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const feedsSnapshotCandidate = useMemo(
    () => (selectedAccountId !== null && feeds !== undefined ? { accountId: selectedAccountId, feeds } : null),
    [feeds, selectedAccountId],
  );
  const { snapshot: feedsSnapshot } = useScreenSnapshot(feedsSnapshotCandidate, feedsSnapshotCandidate !== null);
  const adoptedFeedsSnapshot = adoptSnapshotByKey(feedsSnapshot, "accountId", selectedAccountId);
  const resolvedFeeds = adoptedFeedsSnapshot?.feeds ?? feeds;
  const accountSelectionArticles =
    smartViewKind === "starred" ? starredArticles : smartViewKind === "recent" ? recentArticles : accountArticles;
  const primarySourceArticles = resolvePrimarySourceArticles({
    selectionContext,
    articles,
    tagArticles,
    accountSelectionArticles,
  });
  const primarySourceLoading = resolvePrimarySourceLoading({
    selectionContext,
    isLoading,
    isLoadingTagArticles,
    smartViewKind,
    isLoadingStarredArticles,
    isLoadingRecentArticles,
    isLoadingAccountArticles,
  });
  const primarySourceSnapshotCandidate = useMemo<ArticleListPrimarySourceSnapshot | null>(
    () =>
      primarySourceArticles === undefined
        ? null
        : {
            contextKey: selectionContext.key,
            articles: primarySourceArticles,
          },
    [primarySourceArticles, selectionContext.key],
  );
  const { snapshot: primarySourceSnapshot } = useScreenSnapshot(
    primarySourceSnapshotCandidate,
    primarySourceSnapshotCandidate !== null,
  );
  const adoptedPrimarySourceSnapshot = adoptSnapshotByKey(primarySourceSnapshot, "contextKey", selectionContext.key);
  const resolvedPrimarySourceArticles = adoptedPrimarySourceSnapshot?.articles ?? primarySourceArticles;
  const currentRetainedArticles = useMemo(() => {
    return collectRetainedArticlesFromSources({
      retainedArticleIds,
      sources: [
        primarySourceArticles,
        accountArticles,
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
        contextKey: selectionContext.key,
        retainedArticleIds,
        currentRetainedArticles,
      });
    });
  }, [currentRetainedArticles, retainedArticleIds, selectionContext.key]);
  const resolvedPrimarySourceArticlesWithRetained = useMemo(() => {
    return mergeResolvedArticlesWithRetained({
      resolvedPrimarySourceArticles,
      retainedArticlesSnapshot,
      retainedArticleIds,
      contextKey: selectionContext.key,
    });
  }, [resolvedPrimarySourceArticles, retainedArticleIds, retainedArticlesSnapshot, selectionContext.key]);
  const isPrimarySourceLoading = primarySourceLoading && adoptedPrimarySourceSnapshot === null;

  return {
    feedId,
    folderId,
    tagId,
    smartViewKind,
    accountListScopeId,
    feeds: resolvedFeeds,
    articles: selectionContext.kind === "feed" ? resolvedPrimarySourceArticlesWithRetained : articles,
    accountArticles: selectionContext.kind === "account" ? resolvedPrimarySourceArticlesWithRetained : accountArticles,
    tagArticles: selectionContext.kind === "tag" ? resolvedPrimarySourceArticlesWithRetained : tagArticles,
    isLoading: selectionContext.kind === "feed" ? isPrimarySourceLoading : isLoading,
    isLoadingAccountArticles: selectionContext.kind === "account" ? isPrimarySourceLoading : isLoadingAccountArticles,
    isLoadingTagArticles: selectionContext.kind === "tag" ? isPrimarySourceLoading : isLoadingTagArticles,
  };
}
