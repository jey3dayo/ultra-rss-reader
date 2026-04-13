import type { AccountSyncError, AccountSyncWarning, SyncResultDto } from "@/api/schemas/sync-result";

export type SyncFeedback =
  | { kind: "already-in-progress" }
  | { kind: "partial-failure"; accounts: string }
  | { kind: "warnings"; accounts: string }
  | { kind: "success" };

function getDistinctAccountNames(items: Array<AccountSyncError | AccountSyncWarning>): string {
  return [...new Set(items.map((item) => item.account_name))].join(", ");
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
    return {
      kind: "warnings",
      accounts: getDistinctAccountNames(result.warnings),
    };
  }

  return { kind: "success" };
}

export function getSyncWarningAccountNames(warnings: AccountSyncWarning[]): string {
  return getDistinctAccountNames(warnings);
}
