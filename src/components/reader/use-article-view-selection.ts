import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useAccountArticles, useArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useArticlesByTag } from "@/hooks/use-tags";
import { findSelectedArticle } from "@/lib/article-view";
import { useUiStore } from "@/stores/ui-store";

export type ArticleViewSelectionState =
  | { kind: "feed-cleanup" }
  | { kind: "browser-only"; browserUrl: string }
  | { kind: "empty" }
  | { kind: "not-found" }
  | { kind: "article"; article: ArticleDto; feed?: FeedDto };

export function useArticleViewSelection(): ArticleViewSelectionState {
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const feedCleanupOpen = useUiStore((s) => s.feedCleanupOpen);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);

  if (feedCleanupOpen) {
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
    accountArticles,
    tagArticles,
  });

  if (Result.isFailure(articleResult)) {
    return { kind: "not-found" };
  }

  const article = Result.unwrap(articleResult);
  const feed = feeds?.find((candidate) => candidate.id === article.feed_id);

  return { kind: "article", article, feed };
}
