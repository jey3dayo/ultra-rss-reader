import { Result } from "@praha/byethrow";

/**
 * Returns the preferred link target for a feed website action.
 *
 * This helper only normalizes caller-provided strings by trimming outer whitespace:
 * it prefers a non-empty site URL, falls back to a non-empty feed URL, and returns
 * null when both inputs are blank after trimming. URL validity is handled by
 * upstream add-feed/provider boundaries, not here.
 */
export function resolveFeedWebsiteHref(siteUrl: string, feedUrl: string): string | null {
  const normalizedSiteUrl = siteUrl.trim();
  const normalizedFeedUrl = feedUrl.trim();
  return normalizedSiteUrl || normalizedFeedUrl || null;
}

export type ExtractSiteHostError = { type: "missing_url" } | { type: "invalid_url"; value: string };

/**
 * Extract the hostname from a feed's site_url or fallback url.
 *
 * Host labels are intentionally resilient: an invalid site URL does not block a
 * valid feed URL from providing a favicon/host label fallback.
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
