import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import {
  pickImageViewerOverlayArticle,
  pickImageViewerOverlayFeed,
  rankImageViewerOverlayFeeds,
  resolveImageViewerOverlayBrowserUrl,
} from "@/lib/dev-image-viewer-overlay";
import { type DevScenarioId, isDevScenarioId } from "@/lib/dev-scenario-ids";

export type DevIntent = DevScenarioId | null;

const DEV_INTENT_ENV_KEYS = ["VITE_DEV_INTENT", "VITE_ULTRA_RSS_DEV_INTENT"] as const;
const DEV_WEB_URL_ENV_KEYS = ["VITE_DEV_WEB_URL", "VITE_ULTRA_RSS_DEV_WEB_URL"] as const;

function readFirstNonEmptyEnv(keys: readonly string[]): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;

  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export function parseDevIntent(value: string | undefined): DevIntent {
  if (!value) {
    return null;
  }

  return isDevScenarioId(value) ? value : null;
}

export function readDevIntent(): DevIntent {
  if (!import.meta.env.DEV) {
    return null;
  }

  return parseDevIntent(readFirstNonEmptyEnv(DEV_INTENT_ENV_KEYS));
}

export function readDevWebUrl(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  return readFirstNonEmptyEnv(DEV_WEB_URL_ENV_KEYS) ?? null;
}

export function isLegacyOverlayDevIntent(intent: DevIntent): intent is "image-viewer-overlay" {
  return intent === "image-viewer-overlay";
}

export function readLegacyOverlayDevIntent(): "image-viewer-overlay" | null {
  const intent = readDevIntent();
  return isLegacyOverlayDevIntent(intent) ? intent : null;
}

export function isLegacyOverlayBrowserUrl(url: string | null): boolean {
  if (!url) {
    return false;
  }

  return url === resolveImageViewerOverlayBrowserUrl(null);
}

export function resolveDevIntentBrowserUrl(intent: DevIntent, fallbackUrl: string | null): string | null {
  if (intent !== "image-viewer-overlay") {
    return fallbackUrl;
  }

  return resolveImageViewerOverlayBrowserUrl(fallbackUrl);
}

export function resolveActiveDevIntentBrowserUrl(
  intent: DevIntent,
  activeBrowserUrl: string | null,
  fallbackUrl: string | null,
): string | null {
  if (isLegacyOverlayBrowserUrl(activeBrowserUrl)) {
    return activeBrowserUrl;
  }

  return resolveDevIntentBrowserUrl(intent, fallbackUrl);
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
