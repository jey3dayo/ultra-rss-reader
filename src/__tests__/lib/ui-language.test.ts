import { describe, expect, it } from "vitest";
import { resolveUiLanguage } from "@/lib/ui/ui-language";

describe("resolveUiLanguage", () => {
  it.each([
    ["system", "ja-JP", "ja"],
    ["system", "JA", "ja"],
    ["system", "fr-FR", "en"],
    ["system", "", "en"],
    ["ja", "en-US", "ja"],
    ["en", "ja-JP", "en"],
  ] as const)(
    "matches the native menu resolver fixture %#",
    (preference, locale, expected) => {
      expect(resolveUiLanguage(preference, locale)).toBe(expected);
    },
  );

  it("resolves system to Japanese for ja locales", () => {
    expect(resolveUiLanguage("system", "ja-JP")).toBe("ja");
    expect(resolveUiLanguage("system", "JA")).toBe("ja");
  });

  it("resolves system to English for non-ja locales", () => {
    expect(resolveUiLanguage("system", "en-US")).toBe("en");
    expect(resolveUiLanguage("system", "fr-FR")).toBe("en");
  });

  it("resolves system to English when the system locale is unavailable", () => {
    expect(resolveUiLanguage("system", undefined)).toBe("en");
    expect(resolveUiLanguage("system", "")).toBe("en");
  });

  it("keeps explicit Japanese regardless of system locale", () => {
    expect(resolveUiLanguage("ja", "en-US")).toBe("ja");
  });

  it("keeps explicit English regardless of system locale", () => {
    expect(resolveUiLanguage("en", "ja-JP")).toBe("en");
  });
});
