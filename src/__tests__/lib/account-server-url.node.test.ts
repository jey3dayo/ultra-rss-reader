import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  isValidOptionalHttpServerUrl,
  isValidRequiredHttpServerUrl,
  validateFreshRssServerUrl,
} from "@/lib/account/server-url";

describe("account server URL helpers", () => {
  it("normalizes FreshRSS HTTP server URLs and rejects credential URLs", () => {
    const normalized = validateFreshRssServerUrl(" https://reader.example.com/api/greader.php/// ");
    const credentialUrl = validateFreshRssServerUrl("https://user:pass@reader.example.com");

    expect(Result.isSuccess(normalized)).toBe(true);
    expect(Result.unwrap(normalized)).toBe("https://reader.example.com/api/greader.php");
    expect(Result.isFailure(credentialUrl)).toBe(true);
    expect(Result.unwrapError(credentialUrl)).toBe("server_url_credentials");
  });

  it("distinguishes required and optional HTTP URL validation", () => {
    expect(isValidRequiredHttpServerUrl("https://reader.example.com")).toBe(true);
    expect(isValidRequiredHttpServerUrl("ftp://reader.example.com")).toBe(false);
    expect(isValidRequiredHttpServerUrl("   ")).toBe(false);

    expect(isValidOptionalHttpServerUrl(null)).toBe(true);
    expect(isValidOptionalHttpServerUrl("   ")).toBe(true);
    expect(isValidOptionalHttpServerUrl("http://localhost:8080")).toBe(true);
    expect(isValidOptionalHttpServerUrl("not a url")).toBe(false);
  });
});
