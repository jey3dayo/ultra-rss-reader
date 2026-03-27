import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import { extractSiteHost } from "@/lib/feed";

describe("extractSiteHost", () => {
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
    expect(Result.unwrapError(result)).toBe("not-a-url");
  });

  it("prefers site_url over feed url", () => {
    const result = extractSiteHost("https://site.example.com", "https://feed.example.com/rss");
    expect(Result.unwrap(result)).toBe("site.example.com");
  });

  it("returns error with raw string when both site_url and feed url are unparseable", () => {
    const result = extractSiteHost("not-valid", "");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toBe("not-valid");
  });

  it("uses site_url even if invalid (matches original behavior)", () => {
    // When site_url is truthy but invalid, the function tries to parse it and fails
    const result = extractSiteHost("not-valid", "https://feed.example.com/rss");
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toBe("not-valid");
  });
});
