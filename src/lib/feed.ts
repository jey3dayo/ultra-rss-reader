import { Result } from "@praha/byethrow";

/**
 * Extract the hostname from a feed's site_url or fallback url.
 * Returns Result with hostname on success, or the raw url string on parse failure.
 */
export function extractSiteHost(siteUrl: string, feedUrl: string): Result.Result<string, string> {
  const url = siteUrl || feedUrl;
  try {
    return Result.succeed(new URL(url).hostname);
  } catch {
    return Result.fail(url);
  }
}

export function resolveSiteHostLabel(siteUrl: string, feedUrl: string): string {
  const hostResult = extractSiteHost(siteUrl, feedUrl);
  return Result.isSuccess(hostResult) ? Result.unwrap(hostResult) : Result.unwrapError(hostResult);
}
