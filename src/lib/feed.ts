import { Result } from "@praha/byethrow";

export function resolveFeedWebsiteHref(siteUrl: string, feedUrl: string): string | null {
  return siteUrl || feedUrl || null;
}

/**
 * Extract the hostname from a feed's site_url or fallback url.
 * Returns Result with hostname on success, or the raw url string on parse failure.
 */
export function extractSiteHost(siteUrl: string, feedUrl: string): Result.Result<string, string> {
  const url = resolveFeedWebsiteHref(siteUrl, feedUrl);
  if (!url) {
    return Result.fail("");
  }

  return Result.try({
    try: () => new URL(url).hostname,
    catch: () => url,
  });
}

export function resolveSiteHostLabel(siteUrl: string, feedUrl: string): string {
  const hostResult = extractSiteHost(siteUrl, feedUrl);
  return Result.isSuccess(hostResult) ? Result.unwrap(hostResult) : Result.unwrapError(hostResult);
}
