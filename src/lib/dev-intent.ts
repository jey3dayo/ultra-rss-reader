import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { DevScenarioId } from "@/dev/scenarios";
import { getDevScenario } from "@/dev/scenarios";
import {
  pickImageViewerOverlayArticle,
  pickImageViewerOverlayFeed,
  rankImageViewerOverlayFeeds,
  resolveImageViewerOverlayBrowserUrl,
} from "@/dev/scenarios/helpers";

export type DevIntent = DevScenarioId | null;

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

export function resolveDevIntentBrowserUrl(intent: DevIntent, fallbackUrl: string | null): string | null {
  if (intent !== "image-viewer-overlay") {
    return fallbackUrl;
  }

  return resolveImageViewerOverlayBrowserUrl(fallbackUrl);
}

export function pickDevIntentFeed(feeds: FeedDto[]): FeedDto | null {
  return pickImageViewerOverlayFeed(feeds);
}

export function rankDevIntentFeeds(feeds: FeedDto[]): FeedDto[] {
  return rankImageViewerOverlayFeeds(feeds);
}

export function pickDevIntentArticle(articles: ArticleDto[]): ArticleDto | null {
  return pickImageViewerOverlayArticle(articles);
}
