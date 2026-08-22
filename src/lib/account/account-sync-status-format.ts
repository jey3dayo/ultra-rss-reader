import {
  formatHourMinute,
  formatShortDate,
  formatShortDateTime,
  getCurrentDate,
  isSameLocalDay,
  parseDateInput,
} from "@/lib/datetime";

/**
 * `last_error` is an older persisted AppError display string, so historical
 * sync-state rows cannot be migrated to a structured value at read time.
 * Classify its stable error prefix at the presentation boundary and keep the
 * remaining text as the detail interpolation parameter.
 */
export const ACCOUNT_SYNC_ERROR_KINDS = [
  "network",
  "rate_limit",
  "parse",
  "persistence",
  "auth",
  "validation",
  "keychain",
  "migration",
] as const;

export type AccountSyncErrorKind = (typeof ACCOUNT_SYNC_ERROR_KINDS)[number];

type AccountSyncErrorPrefix = {
  prefix: string;
  kind: AccountSyncErrorKind;
};

const ACCOUNT_SYNC_ERROR_PREFIXES = [
  { prefix: "Network error:", kind: "network" },
  { prefix: "Rate limit error:", kind: "rate_limit" },
  { prefix: "Parse error:", kind: "parse" },
  { prefix: "Persistence error:", kind: "persistence" },
  { prefix: "Auth error:", kind: "auth" },
  { prefix: "Validation error:", kind: "validation" },
  { prefix: "Keychain error:", kind: "keychain" },
  { prefix: "Migration error:", kind: "migration" },
] as const satisfies readonly AccountSyncErrorPrefix[];

export type AccountSyncErrorTranslation = {
  key: AccountSyncErrorKind | null;
  params: { message: string };
};

export function getAccountSyncErrorTranslationKey(lastError: string): AccountSyncErrorTranslation {
  const normalizedError = lastError.trim();
  const matchedPrefix = ACCOUNT_SYNC_ERROR_PREFIXES.find(({ prefix }) => normalizedError.startsWith(prefix));

  if (!matchedPrefix) {
    return {
      key: null,
      params: { message: normalizedError },
    };
  }

  const detail = normalizedError.slice(matchedPrefix.prefix.length).trim();
  return {
    key: matchedPrefix.kind,
    params: { message: detail.length > 0 ? detail : normalizedError },
  };
}

export function formatAccountSyncRetryTime(retryAt: string | undefined, language: string): string | null {
  return formatHourMinute(retryAt, language);
}

export function formatAccountSyncRetryDateTime(retryAt: string | undefined, language: string): string | null {
  return formatShortDateTime(retryAt, language);
}

export function formatAccountLastSuccessLabel(
  lastSuccessAt: string | undefined,
  language: string,
  now: Date = getCurrentDate(),
): {
  date: string;
  time: string;
  isToday: boolean;
} | null {
  const date = parseDateInput(lastSuccessAt);
  if (date === null) {
    return null;
  }

  return {
    date: formatShortDate(date, language) ?? "",
    time: formatHourMinute(date, language) ?? "",
    isToday: isSameLocalDay(date, now),
  };
}
