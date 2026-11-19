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

type AccountSyncErrorKind = (typeof ACCOUNT_SYNC_ERROR_KINDS)[number];

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

/**
 * The keychain "needs auth" recovery instruction is persisted into
 * `last_error` as the English `NEEDS_AUTH` constant owned by the Rust
 * keyring store (`src-tauri/src/infra/keyring_store/mod.rs`). Match its
 * stable opening at this presentation boundary so the instruction is
 * rendered from locale resources instead of the English source text.
 */
const KEYCHAIN_NEEDS_AUTH_DETAIL_PREFIX = "Credential access needs attention.";

export type AccountSyncErrorTranslation = {
  key: AccountSyncErrorKind | "keychain_needs_auth" | null;
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
  if (matchedPrefix.kind === "keychain" && detail.startsWith(KEYCHAIN_NEEDS_AUTH_DETAIL_PREFIX)) {
    return {
      key: "keychain_needs_auth",
      params: { message: "" },
    };
  }

  return {
    key: matchedPrefix.kind,
    params: { message: detail },
  };
}

export function formatAccountSyncRetryTime(retryAt: string | undefined, language: string): string | null {
  return formatHourMinute(retryAt, language);
}

export function formatAccountSyncRetryDateTime(retryAt: string | undefined, language: string): string | null {
  return formatShortDateTime(retryAt, language);
}

export function getFutureAccountSyncRetry(
  status: { next_retry_at?: string | null; waiting_for_credential_access?: boolean | null } | undefined,
  now: number,
): number | null {
  if (status?.waiting_for_credential_access) return null;
  const date = parseDateInput(status?.next_retry_at);
  return date && date.getTime() > now ? date.getTime() : null;
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
