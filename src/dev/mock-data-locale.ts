/**
 * Dev-mock locale selection for browser-only development mode.
 *
 * `VITE_DEV_MOCK_LOCALE` picks which seed dataset `mock-data.ts` assembles
 * (`ja`, the default; `en` for English demos; `store` and `store-ja` for
 * language-specific screenshot fixtures only).
 * Follows the same "read first non-empty env" convention as
 * `src/dev/intent.ts`'s `DEV_RUNTIME_ENV_KEYS`.
 */

import { readFirstNonEmptyEnv } from "./env";

export type DevMockLocale = "ja" | "en" | "store" | "store-ja";

const DEV_MOCK_LOCALE_ENV_KEYS = ["VITE_DEV_MOCK_LOCALE"] as const;

function parseDevMockLocale(value: string | undefined): DevMockLocale {
  return value === "en" || value === "store" || value === "store-ja" ? value : "ja";
}

export function readDevMockLocale(): DevMockLocale {
  return parseDevMockLocale(readFirstNonEmptyEnv(DEV_MOCK_LOCALE_ENV_KEYS));
}

export function isEnglishDevMockLocale(): boolean {
  const locale = readDevMockLocale();
  return locale === "en" || locale === "store";
}

export function isStoreScreenshotDevMockLocale(): boolean {
  const locale = readDevMockLocale();
  return locale === "store" || locale === "store-ja";
}
