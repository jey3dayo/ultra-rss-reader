import type { ViewMode } from "@/lib/reader/view-mode.types";

type ArticleRetentionViewMode = ViewMode;

// Keep a large but finite safety cap: this short-lived, non-persisted Set is
// consumed only through O(1) membership checks, and 10,000 fixed 64-character
// SHA-256 hex IDs are about 1.3 MB of string data.
export const MAX_RETAINED_ARTICLE_IDS = 10000;

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

export function addRetainedArticles(
  currentRetainedArticleIds: ReadonlySet<string>,
  articleIds: readonly string[],
): Set<string> {
  const validArticleIds = articleIds.filter((articleId) => articleId.trim() !== "");
  return capRetainedArticleIds([...currentRetainedArticleIds, ...validArticleIds]);
}

function capRetainedArticleIds(articleIds: Iterable<string>): Set<string> {
  // The source order is not a contract because some Rust responses have no
  // ORDER BY. If this safety cap is reached, which IDs survive is undefined.
  return new Set([...articleIds].slice(-MAX_RETAINED_ARTICLE_IDS));
}
