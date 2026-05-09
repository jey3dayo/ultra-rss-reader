import { Result } from "@praha/byethrow";

export function resolveFeedWebsiteHref(siteUrl: string, feedUrl: string): string | null {
  const normalizedSiteUrl = siteUrl.trim();
  const normalizedFeedUrl = feedUrl.trim();
  return normalizedSiteUrl || normalizedFeedUrl || null;
}

export type ExtractSiteHostError = { type: "missing_url" } | { type: "invalid_url"; value: string };

/**
 * Extract the hostname from a feed's site_url or fallback url.
 */
export function extractSiteHost(siteUrl: string, feedUrl: string): Result.Result<string, ExtractSiteHostError> {
  const normalizedSiteUrl = siteUrl.trim();
  const normalizedFeedUrl = feedUrl.trim();
  const urls = [normalizedSiteUrl, normalizedFeedUrl].filter((url) => url.length > 0);
  if (urls.length === 0) {
    return Result.fail({ type: "missing_url" });
  }

  let invalidUrl = "";
  for (const url of urls) {
    try {
      return Result.succeed(new URL(url).hostname);
    } catch {
      invalidUrl = url;
    }
  }

  return Result.fail({ type: "invalid_url", value: invalidUrl });
}

export function resolveSiteHostLabel(siteUrl: string, feedUrl: string): string {
  const hostResult = extractSiteHost(siteUrl, feedUrl);
  if (Result.isSuccess(hostResult)) {
    return Result.unwrap(hostResult);
  }

  const error = Result.unwrapError(hostResult);
  return error.type === "invalid_url" ? error.value : "";
}
