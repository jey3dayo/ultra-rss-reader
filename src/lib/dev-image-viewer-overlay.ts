import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { resolveFeedDisplayOverrides } from "@/lib/article-display";

const DEFAULT_FEED_HINTS = ["マガポケ", "ジャンプ+", "comic", "manga", "少年ジャンプ", "ゴリミー"];

export function resolveImageViewerOverlayBrowserUrl(fallbackUrl: string | null): string | null {
  if (typeof window === "undefined") {
    return fallbackUrl;
  }

  return new URL("/dev-image-viewer.html", window.location.origin).toString();
}

function scoreFeed(feed: FeedDto): number {
  const normalized = [feed.title, feed.url, feed.site_url].filter(Boolean).join(" ").toLowerCase();
  const hintScore = DEFAULT_FEED_HINTS.reduce((score, hint, index) => {
    return normalized.includes(hint.toLowerCase()) ? score + (DEFAULT_FEED_HINTS.length - index) * 100 : score;
  }, 0);

  const unreadScore = Math.min(feed.unread_count, 100);
  const displayOverrides = resolveFeedDisplayOverrides(feed);
  const displayModeScore = displayOverrides.readerMode === "on" && displayOverrides.webPreviewMode === "on" ? 500 : 0;
  return displayModeScore + hintScore + unreadScore;
}

export function pickImageViewerOverlayFeed(feeds: FeedDto[]): FeedDto | null {
  if (feeds.length === 0) {
    return null;
  }

  return rankImageViewerOverlayFeeds(feeds)[0] ?? null;
}

export function rankImageViewerOverlayFeeds(feeds: FeedDto[]): FeedDto[] {
  return [...feeds].sort((left, right) => scoreFeed(right) - scoreFeed(left));
}

function scoreArticle(article: ArticleDto): number {
  const urlScore = article.url ? 1000 : 0;
  const unreadScore = article.is_read ? 0 : 100;
  const thumbnailScore = article.thumbnail ? 25 : 0;
  return urlScore + unreadScore + thumbnailScore;
}

export function pickImageViewerOverlayArticle(articles: ArticleDto[]): ArticleDto | null {
  if (articles.length === 0) {
    return null;
  }

  return [...articles].sort((left, right) => scoreArticle(right) - scoreArticle(left))[0] ?? null;
}
