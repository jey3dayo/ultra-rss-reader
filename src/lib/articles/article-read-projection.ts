import type { ReaderFilter } from "@/lib/reader/reader-query";
import type { ViewMode } from "@/lib/reader/view-mode.types";

/**
 * Article read-state projection contract.
 *
 * Read state propagates to each pane through deliberately different channels:
 *
 * 1. Sidebar (feed/folder rows): driven by unread-count refetch via
 *    invalidateArticleMutationQueries("article-read") — never cache-patched.
 *    Rows disappear by count, not by row removal.
 * 2. Article list queries: per-mode keep/drop policy (shouldKeepArticleInListQuery).
 *    "unread" drops rows that become read; "all" keeps rows and only patches
 *    is_read (icon change); "starred" keeps read rows — removal happens only on
 *    unstar. Exception: in the unread view, rows marked read stay visible through
 *    the ui-store retention set (cap MAX_RETAINED_ARTICLE_IDS in
 *    article-retention.ts; retained DTOs are resolved from the always-mounted
 *    "all"-mode list caches).
 * 3. Article detail pane: queryKeys.articles.byId is patched directly for
 *    immediate read-icon feedback.
 * 4. Single mark-read (useSetRead) is optimistic with a latest-only request-id
 *    guard and error rollback. Bulk mark-read is reactive post-success from
 *    server-returned IDs (single-pass cache sweep, no rollback — there is no
 *    optimistic pre-state). Both lifecycles must take retain decisions from this
 *    module so the retain-on-read policy has a single owner.
 */

export type ArticleReadStateSnapshot = {
  is_read: boolean;
  is_starred: boolean;
};

export type OptimisticRetainOnReadPlan = {
  shouldRetain: boolean;
  shouldRollbackOnError: boolean;
};

export function shouldKeepArticleInListQuery(mode: ReaderFilter | null, article: ArticleReadStateSnapshot): boolean {
  if (mode === "unread" && article.is_read) {
    return false;
  }

  if (mode === "starred" && !article.is_starred) {
    return false;
  }

  return true;
}

export function planOptimisticRetainOnRead(params: {
  viewMode: ViewMode;
  markingRead: boolean;
  isAlreadyRetained: boolean;
}): OptimisticRetainOnReadPlan {
  const shouldRetain = params.markingRead && params.viewMode === "unread";
  const shouldRollbackOnError = shouldRetain && !params.isAlreadyRetained;

  return { shouldRetain, shouldRollbackOnError };
}

export function shouldRetainBulkMarkedRead(viewMode: ViewMode): boolean {
  return viewMode === "unread";
}
