import type { AccountSyncError, AccountSyncWarning, SyncResultDto } from "@/api/schemas/sync-result";

export type SyncFeedback =
  | { kind: "already-in-progress" }
  | { kind: "partial-failure"; accounts: string }
  | { kind: "retry-scheduled"; accounts: string; retryAt?: string; retryInSeconds?: number }
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

function getDistinctAccountNames(items: Array<AccountSyncError | AccountSyncWarning>): string {
  return [...new Set(items.map((item) => item.account_name))].join(", ");
}

function hasRetryPendingWarnings(warnings: AccountSyncWarning[]): boolean {
  return warnings.some((warning) => warning.kind === "retry_pending");
}

function getEarliestRetryWarning(warnings: AccountSyncWarning[]): AccountSyncWarning | undefined {
  return warnings
    .filter((warning) => warning.kind === "retry_scheduled")
    .sort((left, right) => {
      const leftValue = left.retry_in_seconds ?? Number.MAX_SAFE_INTEGER;
      const rightValue = right.retry_in_seconds ?? Number.MAX_SAFE_INTEGER;
      return leftValue - rightValue;
    })[0];
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
