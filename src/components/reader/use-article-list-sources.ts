import { useEffect, useMemo, useState } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { useAccountArticles, useArticles, useRecentArticles, useStarredArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { adoptSnapshotByKey, useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { useArticlesByTag } from "@/hooks/use-tags";
import type {
  ArticleListPrimarySourceSnapshot,
  UseArticleListSourcesParams,
  UseArticleListSourcesResult,
} from "./article-list.types";

function areArticlesEquivalent(left: ArticleDto[], right: ArticleDto[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((article, index) => {
    const candidate = right[index];
    return (
      candidate !== undefined &&
      article.id === candidate.id &&
      article.is_read === candidate.is_read &&
      article.is_starred === candidate.is_starred &&
      article.title === candidate.title
    );
  });
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
  const primarySourceArticles =
    selectionContext.kind === "feed"
      ? articles
      : selectionContext.kind === "tag"
        ? tagArticles
        : accountSelectionArticles;
  const primarySourceLoading =
    selectionContext.kind === "feed"
      ? isLoading
      : selectionContext.kind === "tag"
        ? isLoadingTagArticles
        : smartViewKind === "starred"
          ? isLoadingStarredArticles
          : smartViewKind === "recent"
            ? isLoadingRecentArticles
            : isLoadingAccountArticles;
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
    if (retainedArticleIds.size === 0) {
      return [];
    }

    const merged = new Map<string, ArticleDto>();
    const sources = [
      primarySourceArticles,
      accountArticles,
      recentArticles,
      articles,
      allFeedArticles,
      allAccountArticles,
      tagArticles,
    ];
    for (const source of sources) {
      if (!Array.isArray(source)) {
        continue;
      }
      for (const article of source) {
        if (retainedArticleIds.has(article.id)) {
          merged.set(article.id, article);
        }
      }
    }

    return [...merged.values()];
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
  const [retainedArticlesSnapshot, setRetainedArticlesSnapshot] = useState<{
    contextKey: string;
    articles: NonNullable<typeof primarySourceArticles>;
  } | null>(null);

  useEffect(() => {
    if (retainedArticleIds.size === 0) {
      setRetainedArticlesSnapshot(null);
      return;
    }

    setRetainedArticlesSnapshot((previous) => {
      const preservedArticles =
        previous?.contextKey === selectionContext.key
          ? previous.articles.filter((article) => retainedArticleIds.has(article.id))
          : [];
      const merged = new Map(preservedArticles.map((article) => [article.id, article]));
      for (const article of currentRetainedArticles) {
        merged.set(article.id, article);
      }

      if (merged.size === 0) {
        return null;
      }

      const nextSnapshot = {
        contextKey: selectionContext.key,
        articles: [...merged.values()],
      };

      if (
        previous?.contextKey === nextSnapshot.contextKey &&
        areArticlesEquivalent(previous.articles, nextSnapshot.articles)
      ) {
        return previous;
      }

      return nextSnapshot;
    });
  }, [currentRetainedArticles, retainedArticleIds, selectionContext.key]);
  const resolvedPrimarySourceArticlesWithRetained = useMemo(() => {
    if (retainedArticleIds.size === 0 || resolvedPrimarySourceArticles === undefined) {
      return resolvedPrimarySourceArticles;
    }

    const retainedArticles =
      retainedArticlesSnapshot?.contextKey === selectionContext.key
        ? retainedArticlesSnapshot.articles.filter((article) => retainedArticleIds.has(article.id))
        : [];
    if (retainedArticles.length === 0) {
      return resolvedPrimarySourceArticles;
    }

    const currentIds = new Set(resolvedPrimarySourceArticles.map((article) => article.id));
    const missingRetainedArticles = retainedArticles.filter((article) => !currentIds.has(article.id));
    return missingRetainedArticles.length === 0
      ? resolvedPrimarySourceArticles
      : [...missingRetainedArticles, ...resolvedPrimarySourceArticles];
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
