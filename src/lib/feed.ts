import { Result } from "@praha/byethrow";

export function resolveFeedWebsiteHref(siteUrl: string, feedUrl: string): string | null {
  return siteUrl || feedUrl || null;
}

export type ExtractSiteHostError = { type: "missing_url" } | { type: "invalid_url"; value: string };

/**
 * Extract the hostname from a feed's site_url or fallback url.
 */
export function extractSiteHost(siteUrl: string, feedUrl: string): Result.Result<string, ExtractSiteHostError> {
  const url = resolveFeedWebsiteHref(siteUrl, feedUrl);
  if (!url) {
    return Result.fail({ type: "missing_url" });
  }

  try {
    return Result.succeed(new URL(url).hostname);
  } catch {
    return Result.fail({ type: "invalid_url", value: url });
  }
}

export function resolveSiteHostLabel(siteUrl: string, feedUrl: string): string {
  const hostResult = extractSiteHost(siteUrl, feedUrl);
  if (Result.isSuccess(hostResult)) {
    return Result.unwrap(hostResult);
  }

  const error = Result.unwrapError(hostResult);
  return error.type === "invalid_url" ? error.value : "";
}
