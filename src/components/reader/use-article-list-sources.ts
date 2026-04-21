import { useMemo } from "react";
import { useAccountArticles, useArticles, useStarredArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { adoptSnapshotByKey, useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { useArticlesByTag } from "@/hooks/use-tags";
import type {
  ArticleListPrimarySourceSnapshot,
  UseArticleListSourcesParams,
  UseArticleListSourcesResult,
} from "./article-list.types";

export function useArticleListSources({
  selection,
  selectionContext,
  selectedAccountId,
  selectedArticleId,
}: UseArticleListSourcesParams): UseArticleListSourcesResult {
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const folderId = selection.type === "folder" ? selection.folderId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const smartViewKind = selection.type === "smart" ? selection.kind : null;
  const accountListScopeId = feedId || tagId ? null : selectedAccountId;
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: articles, isLoading } = useArticles(feedId);
  const { data: accountArticles, isLoading: isLoadingAccountArticles } = useAccountArticles(accountListScopeId);
  const { data: starredArticles, isLoading: isLoadingStarredArticles } = useStarredArticles(
    smartViewKind === "starred" ? accountListScopeId : null,
  );
  const { data: tagArticles, isLoading: isLoadingTagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const feedsSnapshotCandidate = useMemo(
    () => (selectedAccountId !== null && feeds !== undefined ? { accountId: selectedAccountId, feeds } : null),
    [feeds, selectedAccountId],
  );
  const { snapshot: feedsSnapshot } = useScreenSnapshot(feedsSnapshotCandidate, feedsSnapshotCandidate !== null);
  const adoptedFeedsSnapshot = adoptSnapshotByKey(feedsSnapshot, "accountId", selectedAccountId);
  const resolvedFeeds = adoptedFeedsSnapshot?.feeds ?? feeds;
  const accountSelectionArticles = smartViewKind === "starred" ? starredArticles : accountArticles;
  const selectedAccountSource = useMemo(
    () =>
      selectedArticleId === null
        ? null
        : smartViewKind === "starred"
          ? (starredArticles?.find((article) => article.id === selectedArticleId) ??
            accountArticles?.find((article) => article.id === selectedArticleId) ??
            null)
          : (accountArticles?.find((article) => article.id === selectedArticleId) ?? null),
    [accountArticles, selectedArticleId, smartViewKind, starredArticles],
  );
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
  const selectedStarredArticleSnapshotCandidate = useMemo(
    () =>
      smartViewKind === "starred" && selectedArticleId
        ? (() => {
            const selectedArticle =
              accountSelectionArticles?.find((article) => article.id === selectedArticleId) ??
              accountArticles?.find((article) => article.id === selectedArticleId) ??
              null;

            return selectedArticle === null
              ? null
              : {
                  contextKey: selectionContext.key,
                  articleId: selectedArticleId,
                  article: selectedArticle,
                };
          })()
        : null,
    [accountArticles, accountSelectionArticles, selectedArticleId, selectionContext.key, smartViewKind],
  );
  const { snapshot: selectedStarredArticleSnapshot } = useScreenSnapshot(
    selectedStarredArticleSnapshotCandidate,
    selectedStarredArticleSnapshotCandidate !== null,
  );
  const adoptedSelectedStarredArticleSnapshot = adoptSnapshotByKey(
    selectedStarredArticleSnapshot,
    "contextKey",
    selectionContext.key,
  );
  const resolvedAccountArticles = useMemo(() => {
    if (smartViewKind !== "starred" || selectedArticleId === null || resolvedPrimarySourceArticles === undefined) {
      return resolvedPrimarySourceArticles;
    }

    const latestSelectedArticle =
      selectedAccountSource ??
      (adoptedSelectedStarredArticleSnapshot?.articleId === selectedArticleId
        ? adoptedSelectedStarredArticleSnapshot.article
        : null);

    if (latestSelectedArticle === null) {
      return resolvedPrimarySourceArticles;
    }

    if (resolvedPrimarySourceArticles.some((article) => article.id === selectedArticleId)) {
      return resolvedPrimarySourceArticles.map((article) =>
        article.id === selectedArticleId ? latestSelectedArticle : article,
      );
    }

    return [latestSelectedArticle, ...resolvedPrimarySourceArticles];
  }, [
    resolvedPrimarySourceArticles,
    adoptedSelectedStarredArticleSnapshot,
    selectedAccountSource,
    selectedArticleId,
    smartViewKind,
  ]);
  const isPrimarySourceLoading = primarySourceLoading && adoptedPrimarySourceSnapshot === null;

  return {
    feedId,
    folderId,
    tagId,
    smartViewKind,
    accountListScopeId,
    feeds: resolvedFeeds,
    articles: selectionContext.kind === "feed" ? resolvedPrimarySourceArticles : articles,
    accountArticles: selectionContext.kind === "account" ? resolvedAccountArticles : accountArticles,
    tagArticles: selectionContext.kind === "tag" ? resolvedPrimarySourceArticles : tagArticles,
    isLoading: selectionContext.kind === "feed" ? isPrimarySourceLoading : isLoading,
    isLoadingAccountArticles: selectionContext.kind === "account" ? isPrimarySourceLoading : isLoadingAccountArticles,
    isLoadingTagArticles: selectionContext.kind === "tag" ? isPrimarySourceLoading : isLoadingTagArticles,
  };
}
