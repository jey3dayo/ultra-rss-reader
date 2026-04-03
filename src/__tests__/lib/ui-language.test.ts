import { describe, expect, it } from "vitest";
import { resolveUiLanguage } from "@/lib/ui-language";

describe("resolveUiLanguage", () => {
  it("resolves system to Japanese for ja locales", () => {
    expect(resolveUiLanguage("system", "ja-JP")).toBe("ja");
  });

  it("resolves system to English for non-ja locales", () => {
    expect(resolveUiLanguage("system", "en-US")).toBe("en");
  });

  it("keeps explicit Japanese regardless of system locale", () => {
    expect(resolveUiLanguage("ja", "en-US")).toBe("ja");
  });

  it("keeps explicit English regardless of system locale", () => {
    expect(resolveUiLanguage("en", "ja-JP")).toBe("en");
  });
});
