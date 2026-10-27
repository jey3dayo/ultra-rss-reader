import { describe, expect, it } from "vitest";
import { extractNormalizedSiteHost, normalizeSiteHost } from "./feed";

describe("normalizeSiteHost", () => {
  it("lowercases the host", () => {
    expect(normalizeSiteHost("Example.COM")).toBe("example.com");
    expect(normalizeSiteHost("GITHUB.COM")).toBe("github.com");
  });

  it("strips leading www. subdomain", () => {
    expect(normalizeSiteHost("www.example.com")).toBe("example.com");
    expect(normalizeSiteHost("WWW.EXAMPLE.COM")).toBe("example.com");
  });

  it("does not strip www in the middle of the host", () => {
    expect(normalizeSiteHost("my.www.example.com")).toBe("my.www.example.com");
  });

  it("handles already normalized hosts", () => {
    expect(normalizeSiteHost("example.com")).toBe("example.com");
    expect(normalizeSiteHost("github.io")).toBe("github.io");
  });
});

describe("extractNormalizedSiteHost", () => {
  it("extracts and normalizes host from site_url", () => {
    expect(extractNormalizedSiteHost("https://www.example.com", "https://example.com/feed")).toBe("example.com");
    expect(extractNormalizedSiteHost("https://EXAMPLE.COM", "https://example.com/feed")).toBe("example.com");
  });

  it("falls back to feed URL when site_url is empty", () => {
    expect(extractNormalizedSiteHost("", "https://www.example.com/feed")).toBe("example.com");
    expect(extractNormalizedSiteHost("", "https://EXAMPLE.COM/rss")).toBe("example.com");
  });

  it("returns null for invalid URLs", () => {
    expect(extractNormalizedSiteHost("", "not-a-url")).toBeNull();
    expect(extractNormalizedSiteHost("invalid", "also-invalid")).toBeNull();
  });

  it("returns null when both URLs are empty", () => {
    expect(extractNormalizedSiteHost("", "")).toBeNull();
  });

  it("handles URLs with paths and query strings", () => {
    expect(extractNormalizedSiteHost("https://www.example.com/path?query=1", "https://example.com/feed")).toBe(
      "example.com",
    );
    expect(extractNormalizedSiteHost("", "https://www.example.com/feed/rss?format=xml")).toBe("example.com");
  });

  it("strips www. consistently", () => {
    expect(extractNormalizedSiteHost("https://www.github.com", "https://github.com/feed")).toBe("github.com");
    expect(extractNormalizedSiteHost("https://github.com", "https://www.github.com/feed")).toBe("github.com");
  });
});
