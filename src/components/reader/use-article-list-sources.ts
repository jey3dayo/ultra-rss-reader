import { useMemo } from "react";
import { useAccountArticles, useArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";
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
}: UseArticleListSourcesParams): UseArticleListSourcesResult {
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const folderId = selection.type === "folder" ? selection.folderId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const smartViewKind = selection.type === "smart" ? selection.kind : null;
  const accountListScopeId = feedId || tagId ? null : selectedAccountId;
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: articles, isLoading } = useArticles(feedId);
  const { data: accountArticles, isLoading: isLoadingAccountArticles } = useAccountArticles(accountListScopeId);
  const { data: tagArticles, isLoading: isLoadingTagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const feedsSnapshotCandidate = useMemo(
    () => (selectedAccountId !== null && feeds !== undefined ? { accountId: selectedAccountId, feeds } : null),
    [feeds, selectedAccountId],
  );
  const { snapshot: feedsSnapshot } = useScreenSnapshot(feedsSnapshotCandidate, feedsSnapshotCandidate !== null);
  const adoptedFeedsSnapshot = feedsSnapshot?.accountId === selectedAccountId ? feedsSnapshot : null;
  const resolvedFeeds = adoptedFeedsSnapshot?.feeds ?? feeds;
  const primarySourceArticles =
    selectionContext.kind === "feed" ? articles : selectionContext.kind === "tag" ? tagArticles : accountArticles;
  const primarySourceLoading =
    selectionContext.kind === "feed" ? isLoading : selectionContext.kind === "tag" ? isLoadingTagArticles : isLoadingAccountArticles;
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
  const adoptedPrimarySourceSnapshot =
    primarySourceSnapshot?.contextKey === selectionContext.key ? primarySourceSnapshot : null;
  const resolvedPrimarySourceArticles = adoptedPrimarySourceSnapshot?.articles ?? primarySourceArticles;
  const isPrimarySourceLoading = primarySourceLoading && adoptedPrimarySourceSnapshot === null;

  return {
    feedId,
    folderId,
    tagId,
    smartViewKind,
    accountListScopeId,
    feeds: resolvedFeeds,
    articles: selectionContext.kind === "feed" ? resolvedPrimarySourceArticles : articles,
    accountArticles: selectionContext.kind === "account" ? resolvedPrimarySourceArticles : accountArticles,
    tagArticles: selectionContext.kind === "tag" ? resolvedPrimarySourceArticles : tagArticles,
    isLoading: selectionContext.kind === "feed" ? isPrimarySourceLoading : isLoading,
    isLoadingAccountArticles: selectionContext.kind === "account" ? isPrimarySourceLoading : isLoadingAccountArticles,
    isLoadingTagArticles: selectionContext.kind === "tag" ? isPrimarySourceLoading : isLoadingTagArticles,
  };
}
