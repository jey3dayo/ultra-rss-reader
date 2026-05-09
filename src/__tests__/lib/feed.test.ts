import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import { extractSiteHost, resolveFeedWebsiteHref, resolveSiteHostLabel } from "@/lib/feed/feed";

describe("extractSiteHost", () => {
  it("resolves website href from site_url before feed url", () => {
    expect(resolveFeedWebsiteHref("https://site.example.com", "https://feed.example.com/rss")).toBe(
      "https://site.example.com",
    );
  });

  it("falls back to feed url when website href is missing", () => {
    expect(resolveFeedWebsiteHref("", "https://feed.example.com/rss")).toBe("https://feed.example.com/rss");
    expect(resolveFeedWebsiteHref("", "")).toBeNull();
  });

  it("normalizes whitespace-only website hrefs before falling back to feed url", () => {
    expect(resolveFeedWebsiteHref("   ", " https://feed.example.com/rss ")).toBe("https://feed.example.com/rss");
    expect(resolveFeedWebsiteHref(" https://site.example.com ", "https://feed.example.com/rss")).toBe(
      "https://site.example.com",
    );
    expect(resolveFeedWebsiteHref("   ", "   ")).toBeNull();
  });

  it("extracts hostname from a valid site_url", () => {
    const result = extractSiteHost("https://example.com/path", "https://fallback.com/feed.xml");
    expect(Result.unwrap(result)).toBe("example.com");
  });

  it("falls back to feed url when site_url is empty", () => {
    const result = extractSiteHost("", "https://fallback.com/feed.xml");
    expect(Result.unwrap(result)).toBe("fallback.com");
  });

  it("returns the raw string when URL parsing fails", () => {
    const result = extractSiteHost("", "not-a-url");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({ type: "invalid_url", value: "not-a-url" });
  });

  it("prefers site_url over feed url", () => {
    const result = extractSiteHost("https://site.example.com", "https://feed.example.com/rss");
    expect(Result.unwrap(result)).toBe("site.example.com");
  });

  it("returns error with raw string when both site_url and feed url are unparseable", () => {
    const result = extractSiteHost("not-valid", "");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({ type: "invalid_url", value: "not-valid" });
  });

  it("falls back to feed url when site_url is invalid", () => {
    const result = extractSiteHost("not-valid", "https://feed.example.com/rss");
    expect(Result.unwrap(result)).toBe("feed.example.com");
  });

  it("returns the feed url error when both site_url and feed url are unparseable", () => {
    const result = extractSiteHost("not-valid-site", "not-valid-feed");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({ type: "invalid_url", value: "not-valid-feed" });
  });

  it("returns a typed error when both urls are missing", () => {
    const result = extractSiteHost("", "");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({ type: "missing_url" });
  });

  it("resolves a host label without exposing Result handling to callers", () => {
    expect(resolveSiteHostLabel("https://example.com/path", "https://fallback.com/feed.xml")).toBe("example.com");
    expect(resolveSiteHostLabel("", "not-a-url")).toBe("not-a-url");
    expect(resolveSiteHostLabel("", "")).toBe("");
  });
});
