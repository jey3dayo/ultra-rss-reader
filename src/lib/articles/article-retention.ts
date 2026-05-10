import type { ViewMode } from "@/lib/reader/view-mode.types";

type ArticleRetentionViewMode = ViewMode;

export const MAX_RETAINED_ARTICLE_IDS = 50;

export type RetainedArticleSelectionParams = {
  articleId: string;
  viewMode: ArticleRetentionViewMode;
  currentRetainedArticleIds: ReadonlySet<string>;
};

export function getRetainedArticleIdsAfterSelectingArticle({
  articleId,
  viewMode,
  currentRetainedArticleIds,
}: RetainedArticleSelectionParams): Set<string> {
  // Keep read-in-place articles visible while the user stays on the same unread screen.
  // Screen/view changes clear the retained set in the UI store.
  if (viewMode !== "unread") {
    return new Set(currentRetainedArticleIds);
  }

  return addRetainedArticle(currentRetainedArticleIds, articleId);
}

export function addRetainedArticle(currentRetainedArticleIds: ReadonlySet<string>, articleId: string): Set<string> {
  if (articleId.trim() === "") {
    return capRetainedArticleIds(currentRetainedArticleIds);
  }

  return capRetainedArticleIds([...currentRetainedArticleIds, articleId]);
}

function capRetainedArticleIds(articleIds: Iterable<string>): Set<string> {
  return new Set([...articleIds].slice(-MAX_RETAINED_ARTICLE_IDS));
}
