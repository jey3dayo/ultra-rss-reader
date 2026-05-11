import type { AccountSyncError, AccountSyncWarning, SyncIssueOwner, SyncResultDto } from "@/api/schemas/sync-result";

export type SyncFeedback =
  | { kind: "already-in-progress" }
  | { kind: "partial-failure"; accounts: string }
  | {
      kind: "retry-scheduled";
      accounts: string;
      retryAt?: string;
      retryInSeconds?: number;
    }
  | { kind: "retry-pending"; accounts: string }
  | { kind: "warnings"; accounts: string }
  | { kind: "success" };

export type SyncFeedbackMessages = {
  alreadyInProgress: string;
  partialFailure: (accounts: string) => string;
  retryScheduled: (accounts: string, retryAt?: string, retryInSeconds?: number) => string;
  retryPending: (accounts: string) => string;
  warnings: (accounts: string) => string;
  success: string;
};

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
  const scheduledRetry = getEarliestRetryWarning(warnings);
  if (scheduledRetry) {
    return {
      kind: "retry-scheduled",
      accounts: getDistinctAccountNames(warnings, copy),
      retryAt: scheduledRetry.retry_at,
      retryInSeconds: scheduledRetry.retry_in_seconds,
    };
  }

  return {
    kind: hasRetryPendingWarnings(warnings) ? "retry-pending" : "warnings",
    accounts: getDistinctAccountNames(warnings, copy),
  };
}

export function resolveSyncFeedbackMessage(feedback: SyncFeedback, messages: SyncFeedbackMessages): string {
  switch (feedback.kind) {
    case "already-in-progress":
      return messages.alreadyInProgress;
    case "partial-failure":
      return messages.partialFailure(feedback.accounts);
    case "retry-scheduled":
      return messages.retryScheduled(feedback.accounts, feedback.retryAt, feedback.retryInSeconds);
    case "retry-pending":
      return messages.retryPending(feedback.accounts);
    case "warnings":
      return messages.warnings(feedback.accounts);
    case "success":
      return messages.success;
  }
}
