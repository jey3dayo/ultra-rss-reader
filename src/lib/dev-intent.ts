import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { DevScenarioId } from "@/dev/scenarios";
import { getDevScenario } from "@/dev/scenarios";
import { resolveFeedDisplayOverrides } from "@/lib/article-display";

export type DevIntent = DevScenarioId | null;

let legacyOverlayExecuted = false;
const DEFAULT_FEED_HINTS = ["マガポケ", "ジャンプ+", "comic", "manga", "少年ジャンプ", "ゴリミー"];

export function parseDevIntent(value: string | undefined): DevIntent {
  if (!value) {
    return null;
  }

  return getDevScenario(value) ? (value as DevScenarioId) : null;
}

export function readDevIntent(): DevIntent {
  if (!import.meta.env.DEV) {
    return null;
  }

  return parseDevIntent(import.meta.env.VITE_ULTRA_RSS_DEV_INTENT);
}

export function isLegacyOverlayDevIntent(intent: DevIntent): intent is "image-viewer-overlay" {
  return intent === "image-viewer-overlay";
}

export function readLegacyOverlayDevIntent(): "image-viewer-overlay" | null {
  const intent = readDevIntent();
  return isLegacyOverlayDevIntent(intent) ? intent : null;
}

export function consumeLegacyOverlayDevIntent(intent: DevIntent): "image-viewer-overlay" | null {
  if (!isLegacyOverlayDevIntent(intent)) {
    return null;
  }

  if (legacyOverlayExecuted) {
    return null;
  }

  legacyOverlayExecuted = true;
  return intent;
}

export function resetLegacyOverlayDevIntentDedup(): void {
  legacyOverlayExecuted = false;
}

export function resolveDevIntentBrowserUrl(intent: DevIntent, fallbackUrl: string | null): string | null {
  if (intent !== "image-viewer-overlay") {
    return fallbackUrl;
  }

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

export function pickDevIntentFeed(feeds: FeedDto[]): FeedDto | null {
  if (feeds.length === 0) {
    return null;
  }

  return rankDevIntentFeeds(feeds)[0] ?? null;
}

export function rankDevIntentFeeds(feeds: FeedDto[]): FeedDto[] {
  return [...feeds].sort((left, right) => scoreFeed(right) - scoreFeed(left));
}

function scoreArticle(article: ArticleDto): number {
  const urlScore = article.url ? 1000 : 0;
  const unreadScore = article.is_read ? 0 : 100;
  const thumbnailScore = article.thumbnail ? 25 : 0;
  return urlScore + unreadScore + thumbnailScore;
}

export function pickDevIntentArticle(articles: ArticleDto[]): ArticleDto | null {
  if (articles.length === 0) {
    return null;
  }

  return [...articles].sort((left, right) => scoreArticle(right) - scoreArticle(left))[0] ?? null;
}
