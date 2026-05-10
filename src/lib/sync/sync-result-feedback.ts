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

const ACTION_OWNER_LABELS: Record<Exclude<SyncIssueOwner, "account">, string> = {
  credential: "credentials",
  feed: "feed",
  scheduler: "scheduler",
};

const MAX_SYNC_FEEDBACK_ACCOUNT_LABELS = 4;

function getIssueAccountName(item: AccountSyncError | AccountSyncWarning): string {
  const accountName = item.account_name.trim();
  return accountName.length > 0 ? accountName : item.account_id;
}

function getIssueOwner(item: AccountSyncError | AccountSyncWarning): SyncIssueOwner {
  return item.action_owner ?? "account";
}

function getIssueOwnerLabel(owner: SyncIssueOwner): string {
  if (owner === "account") {
    return "";
  }
  return ACTION_OWNER_LABELS[owner];
}

function getIssueFeedbackLabel(item: AccountSyncError | AccountSyncWarning): string {
  const accountName = getIssueAccountName(item);
  const ownerLabel = getIssueOwnerLabel(getIssueOwner(item));
  return ownerLabel.length > 0 ? `${accountName} (${ownerLabel})` : accountName;
}

function getDistinctAccountNames(items: Array<AccountSyncError | AccountSyncWarning>): string {
  const labels = [...new Set(items.map(getIssueFeedbackLabel))];
  const visibleLabels = labels.slice(0, MAX_SYNC_FEEDBACK_ACCOUNT_LABELS);
  const omittedCount = labels.length - visibleLabels.length;
  if (omittedCount <= 0) {
    return visibleLabels.join(", ");
  }
  return `${visibleLabels.join(", ")} +${omittedCount} more`;
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

export function summarizeSyncResult(result: SyncResultDto): SyncFeedback {
  if (!result.synced) {
    return { kind: "already-in-progress" };
  }

  if (result.failed.length > 0) {
    return {
      kind: "partial-failure",
      accounts: getDistinctAccountNames(result.failed),
    };
  }

  if (result.warnings.length > 0) {
    return summarizeSyncWarnings(result.warnings);
  }

  return { kind: "success" };
}

export function getSyncWarningAccountNames(warnings: AccountSyncWarning[]): string {
  return getDistinctAccountNames(warnings);
}

export function summarizeSyncWarnings(
  warnings: AccountSyncWarning[],
): Extract<SyncFeedback, { kind: "retry-scheduled" | "retry-pending" | "warnings" }> {
  const scheduledRetry = getEarliestRetryWarning(warnings);
  if (scheduledRetry) {
    return {
      kind: "retry-scheduled",
      accounts: getDistinctAccountNames(warnings),
      retryAt: scheduledRetry.retry_at,
      retryInSeconds: scheduledRetry.retry_in_seconds,
    };
  }

  return {
    kind: hasRetryPendingWarnings(warnings) ? "retry-pending" : "warnings",
    accounts: getDistinctAccountNames(warnings),
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
