/**
 * Dev-mock locale selection for browser-only development mode.
 *
 * `VITE_DEV_MOCK_LOCALE` picks which seed dataset `mock-data.ts` assembles
 * (`ja`, the default, or `en` for landing-page/README screenshot capture).
 * Follows the same "read first non-empty env" convention as
 * `src/dev/intent.ts`'s `DEV_RUNTIME_ENV_KEYS`.
 */

export type DevMockLocale = "ja" | "en";

const DEV_MOCK_LOCALE_ENV_KEYS = ["VITE_DEV_MOCK_LOCALE"] as const;

function readFirstNonEmptyEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function parseDevMockLocale(value: string | undefined): DevMockLocale {
  return value === "en" ? "en" : "ja";
}

export function readDevMockLocale(): DevMockLocale {
  return parseDevMockLocale(readFirstNonEmptyEnv(DEV_MOCK_LOCALE_ENV_KEYS));
}
