const ARTICLE_CONTENT_SCROLL_ANCHOR_SELECTOR = '[data-reader-scroll-anchor="article-content"]';
const ARTICLE_SCROLL_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]';
const ARTICLE_CONTENT_SCROLL_VIEWPORT_RATIO = 0.85;
const ARTICLE_CONTENT_SCROLL_BOTTOM_EPSILON_PX = 4;

export type ArticleContentScrollResult = "scrolled" | "reached-end" | "unavailable";

/** Resolves the nearest scrollable ancestor of the article content anchor, or null when unavailable. */
export function resolveArticleContentScrollContainer(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const anchor = document.querySelector(ARTICLE_CONTENT_SCROLL_ANCHOR_SELECTOR);
  return anchor?.closest<HTMLElement>(ARTICLE_SCROLL_VIEWPORT_SELECTOR) ?? null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function isScrolledToBottom(container: HTMLElement): boolean {
  return (
    container.scrollTop + container.clientHeight >= container.scrollHeight - ARTICLE_CONTENT_SCROLL_BOTTOM_EPSILON_PX
  );
}

/**
 * Scrolls the article content viewport by ~85% of its viewport height.
 * Returns "reached-end" when scrolling down while already at the bottom, so the
 * caller can fall back to next-article navigation instead of no-op scrolling.
 */
export function scrollArticleContentByViewport(direction: 1 | -1): ArticleContentScrollResult {
  const container = resolveArticleContentScrollContainer();
  if (!container) {
    return "unavailable";
  }

  if (direction === 1 && isScrolledToBottom(container)) {
    return "reached-end";
  }

  const scrollAmount = Math.max(1, Math.round(container.clientHeight * ARTICLE_CONTENT_SCROLL_VIEWPORT_RATIO));
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  try {
    container.scrollBy({ top: direction * scrollAmount, behavior });
  } catch {
    container.scrollTop += direction * scrollAmount;
  }
  return "scrolled";
}
