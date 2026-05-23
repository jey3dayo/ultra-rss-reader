import { Result } from "@praha/byethrow";
import type { AccountDto, AppError } from "@/api/tauri-commands";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";

export function extractSyncOnWakeAccountIds(accounts: readonly AccountDto[]): string[] {
  const accountIds: string[] = [];

  for (const account of accounts) {
    if (account.sync_on_wake) {
      accountIds.push(account.id);
    }
  }

  return accountIds;
}

export function logStartupSyncResult<TSuccess>(result: Result.Result<TSuccess, AppError>): void {
  Result.pipe(
    result,
    Result.inspectError((error) => {
      logRuntimeDiagnostic("startup-sync", "Startup sync failed:", error);
    }),
  );
}

export function readSyncOnWakeAccountsResult(result: Result.Result<AccountDto[], AppError>): AccountDto[] | null {
  if (Result.isFailure(result)) {
    logRuntimeDiagnostic("sync-on-wake", "Sync on wake failed to list accounts:", Result.unwrapError(result));
    return null;
  }

  return Result.unwrap(result);
}

export function logSyncOnWakeAccountResult<TSuccess>(
  accountId: string,
  result: Result.Result<TSuccess, AppError>,
): void {
  if (Result.isFailure(result)) {
    logRuntimeDiagnostic("sync-on-wake", "Sync on wake failed:", accountId, Result.unwrapError(result));
  }
}
