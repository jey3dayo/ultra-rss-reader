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

  it("falls back to a valid feed url when the site url is invalid", () => {
    expect(resolveFeedWebsiteHref("not-a-url", "https://feed.example.com/rss")).toBe("https://feed.example.com/rss");
  });

  it.each([
    "not-a-url",
    "mailto:owner@example.com",
    "javascript:alert(1)",
    "https://user:pass@example.com/rss",
  ])("does not expose invalid or credentialed website href candidates: %s", (url) => {
    expect(resolveFeedWebsiteHref(url, "")).toBeNull();
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
    expect(Result.unwrapError(result)).toEqual({
      type: "invalid_url",
      value: "not-a-url",
    });
  });

  it("keeps protocol-relative feed urls as invalid host-label fallback copy", () => {
    const result = extractSiteHost("", "//example.com/feed.xml");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({
      type: "invalid_url",
      value: "//example.com/feed.xml",
    });
    expect(resolveSiteHostLabel("", "//example.com/feed.xml")).toBe("");
  });

  it("keeps malformed URL constructor failures as invalid host-label fallback copy", () => {
    const result = extractSiteHost("", "https://[malformed");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({
      type: "invalid_url",
      value: "https://[malformed",
    });
    expect(resolveSiteHostLabel("", "https://[malformed")).toBe("");
  });

  it("prefers site_url over feed url", () => {
    const result = extractSiteHost("https://site.example.com", "https://feed.example.com/rss");
    expect(Result.unwrap(result)).toBe("site.example.com");
  });

  it("returns error with raw string when both site_url and feed url are unparseable", () => {
    const result = extractSiteHost("not-valid", "");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({
      type: "invalid_url",
      value: "not-valid",
    });
  });

  it("uses the feed url as a resilient fallback when site_url is invalid", () => {
    const result = extractSiteHost("not-valid", "https://feed.example.com/rss");
    expect(Result.unwrap(result)).toBe("feed.example.com");
  });

  it("returns the feed url error when both site_url and feed url are unparseable", () => {
    const result = extractSiteHost("not-valid-site", "not-valid-feed");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({
      type: "invalid_url",
      value: "not-valid-feed",
    });
  });

  it("returns a typed error when both urls are missing", () => {
    const result = extractSiteHost("", "");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({ type: "missing_url" });
  });

  it("resolves a host label without exposing Result handling to callers", () => {
    expect(resolveSiteHostLabel("https://example.com/path", "https://fallback.com/feed.xml")).toBe("example.com");
    expect(resolveSiteHostLabel("", "not-a-url")).toBe("");
    expect(resolveSiteHostLabel("", "")).toBe("");
  });

  it.each([
    ["query token", "https://example.com/feed.xml?token=secret", "example.com"],
    ["userinfo", "https://alice:secret@example.com/feed.xml", ""],
    ["long invalid URL", `not-a-url-${"x".repeat(120)}`, ""],
    ["newline", "https://example.com/feed.xml\nhttps://private.example.com", ""],
    ["unicode host", "https://例え.テスト/feed.xml", "xn--r8jz45g.xn--zckzah"],
  ])("applies privacy-reviewed host label fallback for %s", (_name, url, expectedLabel) => {
    expect(resolveSiteHostLabel("", url)).toBe(expectedLabel);
  });

  it.each([
    {
      name: "http",
      rawUrl: "http://example.com/feed.xml",
      websiteHref: "http://example.com/feed.xml",
      hostLabel: "example.com",
    },
    {
      name: "https with tracking query",
      rawUrl: " https://example.com/feed.xml?utm_source=reader#section ",
      websiteHref: "https://example.com/feed.xml?utm_source=reader#section",
      hostLabel: "example.com",
    },
    {
      name: "protocol relative",
      rawUrl: "//example.com/feed.xml",
      websiteHref: null,
      hostLabel: "",
    },
    {
      name: "relative path",
      rawUrl: "/feed.xml",
      websiteHref: null,
      hostLabel: "",
    },
    {
      name: "userinfo",
      rawUrl: "https://alice:secret@example.com/feed.xml",
      websiteHref: null,
      hostLabel: "",
    },
    {
      name: "unicode host",
      rawUrl: "https://例え.テスト/feed.xml",
      websiteHref: "https://例え.テスト/feed.xml",
      hostLabel: "xn--r8jz45g.xn--zckzah",
    },
    {
      name: "icon url host policy",
      rawUrl: "https://cdn.example.com/icon.png#private",
      websiteHref: "https://cdn.example.com/icon.png#private",
      hostLabel: "cdn.example.com",
    },
  ])("matches provider metadata URL policy fixture for $name", ({ rawUrl, websiteHref, hostLabel }) => {
    expect(resolveFeedWebsiteHref(rawUrl, "")).toBe(websiteHref);
    expect(resolveSiteHostLabel(rawUrl, "")).toBe(hostLabel);
  });
});
