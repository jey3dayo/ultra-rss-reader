/**
 * Dev-mock locale selection for browser-only development mode.
 *
 * `VITE_DEV_MOCK_LOCALE` picks which seed dataset `mock-data.ts` assembles
 * (`ja`, the default; `en` for landing-page/README demos; `store` for the
 * store-screenshot capture, which loads only `store-screenshot-fixtures.ts`).
 * Follows the same "read first non-empty env" convention as
 * `src/dev/intent.ts`'s `DEV_RUNTIME_ENV_KEYS`.
 */

import { readFirstNonEmptyEnv } from "./env";

export type DevMockLocale = "ja" | "en" | "store";

const DEV_MOCK_LOCALE_ENV_KEYS = ["VITE_DEV_MOCK_LOCALE"] as const;

function parseDevMockLocale(value: string | undefined): DevMockLocale {
  return value === "en" || value === "store" ? value : "ja";
}

export function readDevMockLocale(): DevMockLocale {
  return parseDevMockLocale(readFirstNonEmptyEnv(DEV_MOCK_LOCALE_ENV_KEYS));
}

export function isEnglishDevMockLocale(): boolean {
  return readDevMockLocale() !== "ja";
}
