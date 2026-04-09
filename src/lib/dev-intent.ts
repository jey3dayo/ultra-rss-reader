import { Result } from "@praha/byethrow";
import type { ArticleDto, DevRuntimeOptions, FeedDto } from "@/api/tauri-commands";
import { getDevRuntimeOptions } from "@/api/tauri-commands";
import {
  pickImageViewerOverlayArticle,
  pickImageViewerOverlayFeed,
  rankImageViewerOverlayFeeds,
  resolveImageViewerOverlayBrowserUrl,
} from "@/lib/dev-image-viewer-overlay";
import { type DevScenarioId, isDevScenarioId } from "@/lib/dev-scenario-ids";
import { hasTauriRuntime } from "@/lib/window-chrome";

export type DevIntent = DevScenarioId | null;
export type DevWindowSize = {
  width: number | null;
  height: number | null;
};

const DEV_INTENT_ENV_KEYS = ["VITE_DEV_INTENT", "VITE_ULTRA_RSS_DEV_INTENT"] as const;
const DEV_WEB_URL_ENV_KEYS = ["VITE_DEV_WEB_URL", "VITE_ULTRA_RSS_DEV_WEB_URL"] as const;
const DEV_WINDOW_WIDTH_ENV_KEYS = ["VITE_DEV_WINDOW_WIDTH"] as const;
const DEV_WINDOW_HEIGHT_ENV_KEYS = ["VITE_DEV_WINDOW_HEIGHT"] as const;
let runtimeDevOptionsCache: DevRuntimeOptions | null | undefined;
let runtimeDevOptionsPromise: Promise<DevRuntimeOptions | null> | null = null;

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

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveIntegerOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function readRuntimeDevIntent(): DevIntent {
  return parseDevIntent(runtimeDevOptionsCache?.dev_intent ?? undefined);
}

function readRuntimeDevWebUrl(): string | null {
  const value = runtimeDevOptionsCache?.dev_web_url;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRuntimeDevWindowSize(): DevWindowSize | null {
  const width = parsePositiveIntegerOrNull(runtimeDevOptionsCache?.dev_window_width);
  const height = parsePositiveIntegerOrNull(runtimeDevOptionsCache?.dev_window_height);

  if (width === null && height === null) {
    return null;
  }

  return {
    width,
    height,
  };
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

  return parseDevIntent(readFirstNonEmptyEnv(DEV_INTENT_ENV_KEYS)) ?? readRuntimeDevIntent();
}

export function readDevWebUrl(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  return readFirstNonEmptyEnv(DEV_WEB_URL_ENV_KEYS) ?? readRuntimeDevWebUrl();
}

export function readDevWindowSize(): DevWindowSize | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const width = parsePositiveInteger(readFirstNonEmptyEnv(DEV_WINDOW_WIDTH_ENV_KEYS));
  const height = parsePositiveInteger(readFirstNonEmptyEnv(DEV_WINDOW_HEIGHT_ENV_KEYS));

  if (width === null && height === null) {
    return readRuntimeDevWindowSize();
  }

  return {
    width,
    height,
  };
}

export async function loadDevRuntimeOptions(): Promise<DevRuntimeOptions | null> {
  if (!import.meta.env.DEV) {
    runtimeDevOptionsCache = null;
    return null;
  }

  if (runtimeDevOptionsCache !== undefined) {
    return runtimeDevOptionsCache;
  }

  if (!hasTauriRuntime()) {
    runtimeDevOptionsCache = null;
    return null;
  }

  runtimeDevOptionsPromise ??= getDevRuntimeOptions().then((result) =>
    Result.isFailure(result)
      ? (() => {
          console.warn("Failed to load runtime dev options:", Result.unwrapError(result));
          runtimeDevOptionsCache = null;
          return null;
        })()
      : (() => {
          const options = Result.unwrap(result);
          runtimeDevOptionsCache = options;
          return options;
        })(),
  );

  const resolved = await runtimeDevOptionsPromise;
  runtimeDevOptionsPromise = null;
  return resolved;
}

export function resetDevRuntimeOptionsCacheForTests(): void {
  runtimeDevOptionsCache = undefined;
  runtimeDevOptionsPromise = null;
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
