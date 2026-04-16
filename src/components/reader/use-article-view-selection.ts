import { Result } from "@praha/byethrow";
import { useMemo } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useAccountArticles, useArticles, useStarredArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { useArticlesByTag } from "@/hooks/use-tags";
import { findSelectedArticle } from "@/lib/article-view";
import { useUiStore } from "@/stores/ui-store";

export type ArticleViewSelectionState =
  | { kind: "subscriptions-index" }
  | { kind: "feed-cleanup" }
  | { kind: "browser-only"; browserUrl: string }
  | { kind: "empty" }
  | { kind: "not-found" }
  | { kind: "article"; article: ArticleDto; feed?: FeedDto };

export function useArticleViewSelection(): ArticleViewSelectionState {
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const subscriptionsWorkspace = useUiStore((s) => s.subscriptionsWorkspace);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const smartViewKind = selection.type === "smart" ? selection.kind : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: starredArticles } = useStarredArticles(smartViewKind === "starred" ? selectedAccountId : null);
  const { data: tagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);
  const selectionKey = `${selectedAccountId ?? "null"}:${selection.type}`;
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
  const articleSnapshotCandidate = useMemo(
    () =>
      selectedArticleId && selectedAccountSource
        ? {
            selectionKey,
            articleId: selectedArticleId,
            article: selectedAccountSource,
          }
        : null,
    [selectedAccountSource, selectedArticleId, selectionKey],
  );
  const { snapshot: articleSnapshot } = useScreenSnapshot(articleSnapshotCandidate, articleSnapshotCandidate !== null);
  const visibleAccountArticles = useMemo(() => {
    if (smartViewKind !== "starred") {
      return accountArticles;
    }

    if (selectedAccountSource) {
      return [selectedAccountSource, ...(starredArticles ?? []).filter((article) => article.id !== selectedArticleId)];
    }

    if (articleSnapshot?.selectionKey === selectionKey && articleSnapshot.articleId === selectedArticleId) {
      return [
        articleSnapshot.article,
        ...(starredArticles ?? []).filter((article) => article.id !== selectedArticleId),
      ];
    }

    return starredArticles;
  }, [
    accountArticles,
    articleSnapshot,
    selectedAccountSource,
    selectedArticleId,
    selectionKey,
    smartViewKind,
    starredArticles,
  ]);

  if (subscriptionsWorkspace?.kind === "index") {
    return { kind: "subscriptions-index" };
  }

  if (subscriptionsWorkspace?.kind === "cleanup") {
    return { kind: "feed-cleanup" };
  }

  if (contentMode === "browser" && browserUrl && !selectedArticleId) {
    return { kind: "browser-only", browserUrl };
  }

  if (contentMode === "empty" || !selectedArticleId) {
    return { kind: "empty" };
  }

  const articleResult = findSelectedArticle({
    selectedArticleId,
    feedId,
    tagId,
    articles,
    accountArticles: visibleAccountArticles,
    tagArticles,
  });

  if (Result.isFailure(articleResult)) {
    return { kind: "not-found" };
  }

  const article = Result.unwrap(articleResult);
  const feed = feeds?.find((candidate) => candidate.id === article.feed_id);

  return { kind: "article", article, feed };
}
