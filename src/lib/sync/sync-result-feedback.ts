import type {
  AccountSyncError,
  AccountSyncWarning,
  AccountSyncWarningDetail,
  SyncIssueOwner,
  SyncResultDto,
} from "@/api/schemas/sync-result";

export type SyncFeedback =
  | { kind: "already-in-progress" }
  | { kind: "partial-failure"; accounts: string }
  | {
      kind: "retry-scheduled";
      accounts: string;
      retryAt?: string;
      retryInSeconds?: number;
      detail: AccountSyncWarningDetail | null;
      remainingWarningCount: number;
    }
  | {
      kind: "retry-pending";
      accounts: string;
      detail: AccountSyncWarningDetail | null;
      remainingWarningCount: number;
    }
  | {
      kind: "warnings";
      accounts: string;
      detail: AccountSyncWarningDetail | null;
      remainingWarningCount: number;
    }
  | { kind: "success" };

export type SyncFeedbackMessages = {
  alreadyInProgress: string;
  partialFailure: (accounts: string) => string;
  retryScheduled: (accounts: string, retryAt?: string, retryInSeconds?: number) => string;
  retryPending: (accounts: string) => string;
  warnings: (accounts: string) => string;
  success: string;
  /**
   * Renders one representative, localized warning-detail line appended after
   * the base message (see `resolveSyncFeedbackMessage`). Callers resolve the
   * `detail.type` to a `sync_warning_detail.<type>` locale key and append a
   * "+N more" suffix when `remainingCount > 0`. Optional so callers that do
   * not surface warning detail (or tests) are unaffected.
   */
  detailLine?: (detail: AccountSyncWarningDetail, remainingCount: number) => string;
};

/**
 * Maps a structured sync-warning detail to the locale key suffix
 * (`sync_warning_detail.<type>`) and interpolation params a caller's `t()`
 * needs to render it. Pure and UI-copy-free: callers own the actual
 * translated text and namespace (`sidebar` vs `settings`).
 *
 * Kept in sync with `AccountSyncWarningDetailSchema`
 * (`src/api/schemas/sync-result.ts`) and the Rust
 * `AccountSyncWarningDetail` enum; `i18next-locale-contract.node.test.ts`
 * pins the per-variant locale keys.
 */
export function getSyncWarningDetailTranslationKey(detail: AccountSyncWarningDetail): {
  key: AccountSyncWarningDetail["type"];
  params: Record<string, string | number>;
} {
  switch (detail.type) {
    case "pending_mutation_retry":
    case "dropped_pending_mutation":
      return { key: detail.type, params: { mutation: detail.mutation } };
    case "deleted_greader_folders":
      return { key: detail.type, params: { count: detail.count } };
    case "feed_skipped_entries":
      return { key: detail.type, params: { feedTitle: detail.feed_title, count: detail.count } };
    case "feed_articles_vanished":
      // `count` (not `countBefore`) so i18next's plural rule selects
      // `_one`/`_other` from this value; see `sync_warning_detail_more`'s
      // convention below and the `{{count, count}}` locale placeholder.
      return {
        key: detail.type,
        params: { feedTitle: detail.feed_title, count: detail.count_before },
      };
    case "account_skipped_entries":
      return { key: detail.type, params: { accountName: detail.account_name, count: detail.count } };
    case "local_feed_sync_failed":
      return { key: detail.type, params: { feedTitle: detail.feed_title, message: detail.message } };
    case "local_account_sync_operation_failed":
      return { key: detail.type, params: { operation: detail.operation, message: detail.message } };
    case "local_import_result":
      return {
        key: detail.type,
        params: {
          conflicted: detail.conflicted,
          rejectedFiles: detail.rejected_files,
          rejectedOperations: detail.rejected_operations,
        },
      };
    case "startup_repair_marker_failed":
    case "scheduler_load_failed":
      return { key: detail.type, params: { message: detail.message } };
    case "backoff_persist_failed":
      return { key: detail.type, params: { accountName: detail.account_name, message: detail.message } };
    case "background_sync_retry_scheduled":
      return { key: detail.type, params: { accountName: detail.account_name } };
  }
}

export type SyncFeedbackPublicCopy = {
  unknownAccountLabel: string;
  actionOwnerLabels: Record<Exclude<SyncIssueOwner, "account">, string>;
};

export type SyncIssueDiagnosticsDetail = {
  accountId: string;
  accountName: string | null;
  actionOwner: SyncIssueOwner;
};

export const DEFAULT_SYNC_FEEDBACK_PUBLIC_COPY: SyncFeedbackPublicCopy = {
  unknownAccountLabel: "Unknown account",
  actionOwnerLabels: {
    credential: "credentials",
    feed: "feed",
    scheduler: "scheduler",
  },
};

const DEFAULT_SYNC_FEEDBACK_PUBLIC_COPY_OPTIONS: SyncFeedbackPublicCopy = DEFAULT_SYNC_FEEDBACK_PUBLIC_COPY;

const MAX_SYNC_FEEDBACK_ACCOUNT_LABELS = 4;

function getIssueAccountName(item: AccountSyncError | AccountSyncWarning, copy: SyncFeedbackPublicCopy): string {
  const accountName = item.account_name.trim();
  return accountName.length > 0 ? accountName : copy.unknownAccountLabel;
}

function getIssueDiagnosticsAccountName(item: AccountSyncError | AccountSyncWarning): string | null {
  const accountName = item.account_name.trim();
  return accountName.length > 0 ? accountName : null;
}

function getIssueOwner(item: AccountSyncError | AccountSyncWarning): SyncIssueOwner {
  return item.action_owner ?? "account";
}

function getIssueOwnerLabel(owner: SyncIssueOwner, copy: SyncFeedbackPublicCopy): string {
  if (owner === "account") {
    return "";
  }
  return copy.actionOwnerLabels[owner];
}

function getIssueFeedbackLabel(item: AccountSyncError | AccountSyncWarning, copy: SyncFeedbackPublicCopy): string {
  const accountName = getIssueAccountName(item, copy);
  const ownerLabel = getIssueOwnerLabel(getIssueOwner(item), copy);
  return ownerLabel.length > 0 ? `${accountName} (${ownerLabel})` : accountName;
}

function getDistinctAccountNames(
  items: Array<AccountSyncError | AccountSyncWarning>,
  copy: SyncFeedbackPublicCopy,
): string {
  const labels = [...new Set(items.map((item) => getIssueFeedbackLabel(item, copy)))];
  const visibleLabels = labels.slice(0, MAX_SYNC_FEEDBACK_ACCOUNT_LABELS);
  const omittedCount = labels.length - visibleLabels.length;
  if (omittedCount <= 0) {
    return visibleLabels.join(", ");
  }
  return `${visibleLabels.join(", ")} +${omittedCount} more`;
}

export function getSyncIssueDiagnosticsDetails(
  items: Array<AccountSyncError | AccountSyncWarning>,
): SyncIssueDiagnosticsDetail[] {
  return items.map((item) => ({
    accountId: item.account_id,
    accountName: getIssueDiagnosticsAccountName(item),
    actionOwner: getIssueOwner(item),
  }));
}

function hasRetryPendingWarnings(warnings: AccountSyncWarning[]): boolean {
  return warnings.some((warning) => warning.kind === "retry_pending");
}

function getRetryWarningSeconds(warning: AccountSyncWarning): number {
  return warning.retry_in_seconds ?? Number.MAX_SAFE_INTEGER;
}

function getEarliestRetryWarning(warnings: AccountSyncWarning[]): AccountSyncWarning | undefined {
  const scheduledWarnings = warnings.filter((warning) => warning.kind === "retry_scheduled");
  if (scheduledWarnings.length === 0) {
    return undefined;
  }

  const earliestRetrySeconds = Math.min(...scheduledWarnings.map(getRetryWarningSeconds));
  return scheduledWarnings.find((warning) => getRetryWarningSeconds(warning) === earliestRetrySeconds);
}

/**
 * Picks one representative warning detail to surface alongside the
 * kind/message summary, regardless of which sub-kind (warnings-only,
 * retry-pending, or retry-scheduled) was selected. A single warning shows
 * its own detail sentence; multiple warnings show the first available
 * detail plus a "+N more" count, so detail is never silently dropped by a
 * retry-only or retry+generic mix. Warnings whose `detail` normalized to
 * `null` (missing or unrecognized backend variant) are skipped when picking
 * the representative one; if none carry a usable detail, this returns null
 * and callers fall back to the existing summary-only text.
 */
function getRepresentativeWarningDetail(warnings: AccountSyncWarning[]): {
  detail: AccountSyncWarningDetail | null;
  remainingWarningCount: number;
} {
  const withDetail = warnings.find((warning) => warning.detail !== null);
  if (!withDetail || withDetail.detail === null) {
    return { detail: null, remainingWarningCount: 0 };
  }
  return {
    detail: withDetail.detail,
    remainingWarningCount: Math.max(warnings.length - 1, 0),
  };
}

export function summarizeSyncResult(
  result: SyncResultDto,
  copy: SyncFeedbackPublicCopy = DEFAULT_SYNC_FEEDBACK_PUBLIC_COPY_OPTIONS,
): SyncFeedback {
  if (!result.synced) {
    return { kind: "already-in-progress" };
  }

  if (result.failed.length > 0) {
    return {
      kind: "partial-failure",
      accounts: getDistinctAccountNames(result.failed, copy),
    };
  }

  if (result.warnings.length > 0) {
    return summarizeSyncWarnings(result.warnings, copy);
  }

  return { kind: "success" };
}

export function getSyncWarningAccountNames(
  warnings: AccountSyncWarning[],
  copy: SyncFeedbackPublicCopy = DEFAULT_SYNC_FEEDBACK_PUBLIC_COPY_OPTIONS,
): string {
  return getDistinctAccountNames(warnings, copy);
}

export function summarizeSyncWarnings(
  warnings: AccountSyncWarning[],
  copy: SyncFeedbackPublicCopy = DEFAULT_SYNC_FEEDBACK_PUBLIC_COPY_OPTIONS,
): Extract<SyncFeedback, { kind: "retry-scheduled" | "retry-pending" | "warnings" }> {
  const { detail, remainingWarningCount } = getRepresentativeWarningDetail(warnings);
  const scheduledRetry = getEarliestRetryWarning(warnings);
  if (scheduledRetry) {
    return {
      kind: "retry-scheduled",
      accounts: getDistinctAccountNames(warnings, copy),
      retryAt: scheduledRetry.retry_at ?? undefined,
      retryInSeconds: scheduledRetry.retry_in_seconds ?? undefined,
      detail,
      remainingWarningCount,
    };
  }

  return {
    kind: hasRetryPendingWarnings(warnings) ? "retry-pending" : "warnings",
    accounts: getDistinctAccountNames(warnings, copy),
    detail,
    remainingWarningCount,
  };
}

function appendDetailLine(
  base: string,
  detail: AccountSyncWarningDetail | null,
  remainingWarningCount: number,
  detailLine: SyncFeedbackMessages["detailLine"],
): string {
  if (!detail || !detailLine) {
    return base;
  }
  return `${base} ${detailLine(detail, remainingWarningCount)}`;
}

export function resolveSyncFeedbackMessage(feedback: SyncFeedback, messages: SyncFeedbackMessages): string {
  switch (feedback.kind) {
    case "already-in-progress":
      return messages.alreadyInProgress;
    case "partial-failure":
      return messages.partialFailure(feedback.accounts);
    case "retry-scheduled":
      return appendDetailLine(
        messages.retryScheduled(feedback.accounts, feedback.retryAt, feedback.retryInSeconds),
        feedback.detail,
        feedback.remainingWarningCount,
        messages.detailLine,
      );
    case "retry-pending":
      return appendDetailLine(
        messages.retryPending(feedback.accounts),
        feedback.detail,
        feedback.remainingWarningCount,
        messages.detailLine,
      );
    case "warnings":
      return appendDetailLine(
        messages.warnings(feedback.accounts),
        feedback.detail,
        feedback.remainingWarningCount,
        messages.detailLine,
      );
    case "success":
      return messages.success;
  }
}
