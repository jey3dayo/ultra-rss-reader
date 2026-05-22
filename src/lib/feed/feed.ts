import { Result } from "@praha/byethrow";
import { isPrivateIpv4Host } from "@/lib/runtime/host-privacy";

/**
 * Returns the preferred link target for a feed website action.
 *
 * This helper mirrors the app's browser-facing URL policy for feed website
 * links: only valid http(s) URLs without credentials become clickable.
 */
export function resolveFeedWebsiteHref(siteUrl: string, feedUrl: string): string | null {
  return normalizeFeedWebsiteUrlCandidate(siteUrl) ?? normalizeFeedWebsiteUrlCandidate(feedUrl);
}

export type ExtractSiteHostError = { type: "missing_url" } | { type: "invalid_url"; value: string };

export function normalizeFeedWebsiteUrlCandidate(value: string): string | null {
  const normalizedUrl = value.trim();
  if (normalizedUrl.length === 0 || normalizedUrl.includes("\n") || normalizedUrl.includes("\r")) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const isHttpUrl = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    if (!isHttpUrl || parsedUrl.username || parsedUrl.password) {
      return null;
    }

    return normalizedUrl;
  } catch {
    return null;
  }
}

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
    const validUrl = normalizeFeedWebsiteUrlCandidate(url);
    if (!validUrl) {
      invalidUrl = url;
      continue;
    }

    return Result.succeed(new URL(validUrl).hostname);
  }

  return Result.fail({ type: "invalid_url", value: invalidUrl });
}

function normalizeHostForPrivacyPolicy(host: string): string {
  return host.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

export function canUseExternalFaviconEndpoint(host: string): boolean {
  const normalizedHost = normalizeHostForPrivacyPolicy(host);
  if (normalizedHost.length === 0) {
    return false;
  }

  if (normalizedHost === "localhost" || normalizedHost.endsWith(".localhost") || normalizedHost.endsWith(".local")) {
    return false;
  }

  if (isPrivateIpv4Host(normalizedHost)) {
    return false;
  }

  if (
    normalizedHost.includes(":") &&
    (normalizedHost === "::1" ||
      normalizedHost.startsWith("fc") ||
      normalizedHost.startsWith("fd") ||
      normalizedHost.startsWith("fe8") ||
      normalizedHost.startsWith("fe9") ||
      normalizedHost.startsWith("fea") ||
      normalizedHost.startsWith("feb"))
  ) {
    return false;
  }

  return true;
}

export function resolveSiteHostLabel(siteUrl: string, feedUrl: string): string {
  const hostResult = extractSiteHost(siteUrl, feedUrl);
  if (Result.isSuccess(hostResult)) {
    return Result.unwrap(hostResult);
  }

  return "";
}

export function resolveExternalFaviconHost(siteUrl: string, feedUrl: string): string | null {
  const host = resolveSiteHostLabel(siteUrl, feedUrl);
  return host && canUseExternalFaviconEndpoint(host) ? host : null;
}
