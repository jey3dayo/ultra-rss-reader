import { Result } from "@praha/byethrow";
import type { ArticleDto } from "@/api/tauri-commands";

export type CalculateArticleNavigationScrollTopParams = {
  currentScrollTop: number;
  viewportTop: number;
  viewportHeight: number;
  itemTop: number;
  itemHeight: number;
  direction: 1 | -1;
  stickyTopOffset?: number;
  edgePadding?: number;
  maxScrollTop?: number;
};

export function getAdjacentItemId(
  ids: readonly string[],
  selectedId: string | null,
  direction: 1 | -1,
): Result.Result<string, "no_items"> {
  if (ids.length === 0) {
    return Result.fail("no_items");
  }

  const currentIndex = ids.indexOf(selectedId ?? "");
  const nextIndex = currentIndex === -1 ? 0 : Math.max(0, Math.min(ids.length - 1, currentIndex + direction));
  const nextItemId = ids[nextIndex];

  if (!nextItemId) {
    return Result.fail("no_items");
  }

  return Result.succeed(nextItemId);
}

export function getAdjacentArticleId(
  articles: ArticleDto[],
  selectedArticleId: string | null,
  direction: 1 | -1,
): Result.Result<string, "no_articles"> {
  const nextArticleId = getAdjacentItemId(
    articles.map((article) => article.id),
    selectedArticleId,
    direction,
  );

  if (Result.isFailure(nextArticleId)) {
    return Result.fail("no_articles");
  }

  return Result.succeed(Result.unwrap(nextArticleId));
}

export type ArticleCursor = {
  currentId: string | null;
  prevId: string | null;
  nextId: string | null;
  hasPrev: boolean;
  hasNext: boolean;
};

/**
 * Single source of truth for "does a prev/next article exist relative to the current
 * navigable list". `getAdjacentArticleId` clamps at the list boundary and returns the
 * *same* id back instead of failing, so callers must not treat any successful result as
 * "an adjacent article exists" — they must also compare it against `selectedArticleId`.
 * Centralizing that comparison here keeps the article list pane's keyboard navigation and
 * the content pane's next/prev affordance from drifting on this boundary check.
 */
export function resolveArticleCursor(articles: ArticleDto[], selectedArticleId: string | null): ArticleCursor {
  const nextResult = getAdjacentArticleId(articles, selectedArticleId, 1);
  const prevResult = getAdjacentArticleId(articles, selectedArticleId, -1);
  const candidateNextId = Result.isSuccess(nextResult) ? Result.unwrap(nextResult) : null;
  const candidatePrevId = Result.isSuccess(prevResult) ? Result.unwrap(prevResult) : null;
  const hasNext = candidateNextId !== null && candidateNextId !== selectedArticleId;
  const hasPrev = candidatePrevId !== null && candidatePrevId !== selectedArticleId;

  return {
    currentId: selectedArticleId,
    prevId: hasPrev ? candidatePrevId : null,
    nextId: hasNext ? candidateNextId : null,
    hasPrev,
    hasNext,
  };
}

export function calculateArticleNavigationScrollTop(params: CalculateArticleNavigationScrollTopParams): number | null {
  const {
    currentScrollTop,
    viewportTop,
    viewportHeight,
    itemTop,
    itemHeight,
    direction,
    stickyTopOffset = 0,
    edgePadding = 12,
    maxScrollTop = Number.POSITIVE_INFINITY,
  } = params;

  const topBoundary = viewportTop + stickyTopOffset + edgePadding;
  const bottomBoundary = viewportTop + viewportHeight - edgePadding;
  const itemBottom = itemTop + itemHeight;

  let nextScrollTop: number | null = null;

  if (direction === -1 && itemTop < topBoundary) {
    nextScrollTop = currentScrollTop - (topBoundary - itemTop);
  } else if (itemBottom > bottomBoundary) {
    nextScrollTop = currentScrollTop + (itemBottom - bottomBoundary);
  } else if (itemTop < topBoundary) {
    nextScrollTop = currentScrollTop - (topBoundary - itemTop);
  }

  if (nextScrollTop === null) {
    return null;
  }

  const clampedScrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
  return clampedScrollTop === currentScrollTop ? null : clampedScrollTop;
}
