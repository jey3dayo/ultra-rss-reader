import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { syncAccount, updateAccountSync } from "@/api/tauri-commands";
import { invalidateArticleQueries, invalidateFeedQueries } from "@/lib/query/query-invalidation";
import { resolveSyncFeedbackMessage, summarizeSyncResult } from "@/lib/sync/sync-result-feedback";
import { useUiStore } from "@/stores/ui-store";
import type {
  UpdateAccountSyncParams,
  UseAccountDetailSyncControlsParams,
  UseAccountDetailSyncControlsResult,
} from "../../account-detail.types";
import { updateCachedAccount } from "../../account-detail-query-cache";
import { createAccountDetailErrorToast } from "../../account-detail-toast";

type RunAccountSetupSyncParams = {
  accountId: string;
  queryClient: QueryClient;
  t: TFunction<"settings">;
  onSyncStatusChanged?: () => void;
};

function resolveSetupFailureMessage(t: TFunction<"settings">, syncResult: Awaited<ReturnType<typeof syncAccount>>) {
  if (Result.isFailure(syncResult)) {
    return t("account.sync_failed", { message: Result.unwrapError(syncResult).message });
  }

  return resolveSyncFeedbackMessage(summarizeSyncResult(Result.unwrap(syncResult)), {
    alreadyInProgress: t("account.syncing_now"),
    partialFailure: (accounts) => t("account.sync_failed", { message: accounts }),
    retryScheduled: () => t("account.sync_completed_with_retry_pending"),
    retryPending: () => t("account.sync_completed_with_retry_pending"),
    warnings: () => t("account.sync_completed_with_warnings"),
    success: t("account.sync_complete"),
  });
}

export async function runAccountSetupSync({
  accountId,
  queryClient,
  t,
  onSyncStatusChanged,
}: RunAccountSetupSyncParams) {
  useUiStore.getState().startAccountSetup(accountId);

  const syncResult = await syncAccount(accountId);
  onSyncStatusChanged?.();
  void queryClient.invalidateQueries({ queryKey: ["account-sync-status"] });

  if (Result.isFailure(syncResult)) {
    useUiStore.getState().markAccountSetupFailed(accountId, resolveSetupFailureMessage(t, syncResult));
    return;
  }

  invalidateFeedQueries(queryClient, { includeFolders: false });
  invalidateArticleQueries(queryClient, { includeFeedIntegrityReport: false });

  const feedback = summarizeSyncResult(Result.unwrap(syncResult));
  if (feedback.kind !== "success") {
    useUiStore.getState().markAccountSetupFailed(accountId, resolveSetupFailureMessage(t, syncResult));
    return;
  }

  const uiState = useUiStore.getState();
  uiState.markAccountSetupSucceeded(accountId);
  uiState.selectAccount(accountId);
  uiState.selectSmartView("unread");
  uiState.closeSettings();
  uiState.showToast(t("account.setup_complete"));
  uiState.clearAccountSetup();
}

export function useAccountDetailSyncControls({
  account,
  queryClient,
  t,
  onSyncStatusChanged,
  accountSetupState,
}: UseAccountDetailSyncControlsParams): UseAccountDetailSyncControlsResult {
  const showSyncUpdateError = createAccountDetailErrorToast(t, "account.failed_to_update_sync");
  const showSyncError = createAccountDetailErrorToast(t, "account.sync_failed");

  const handleSyncUpdate = async (partial: UpdateAccountSyncParams) => {
    Result.pipe(
      await updateAccountSync(
        account.id,
        partial.syncIntervalSecs ?? account.sync_interval_secs,
        partial.syncOnStartup ?? account.sync_on_startup,
        partial.syncOnWake ?? account.sync_on_wake,
        partial.keepReadItemsDays ?? account.keep_read_items_days,
      ),
      Result.inspectError(showSyncUpdateError),
      Result.inspect((updated) => {
        updateCachedAccount(queryClient, updated);
      }),
    );
  };

  const handleSyncNow = async () => {
    const result = await syncAccount(account.id);
    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        invalidateFeedQueries(queryClient, { includeFolders: false });
        queryClient.invalidateQueries({ queryKey: ["articles"] });
        onSyncStatusChanged?.();
        useUiStore.getState().showToast(
          resolveSyncFeedbackMessage(summarizeSyncResult(syncResult), {
            alreadyInProgress: t("account.syncing_now"),
            partialFailure: (accounts) => t("account.sync_failed", { message: accounts }),
            retryScheduled: () => t("account.sync_completed_with_retry_pending"),
            retryPending: () => t("account.sync_completed_with_retry_pending"),
            warnings: () => t("account.sync_completed_with_warnings"),
            success: t("account.sync_complete"),
          }),
        );
      }),
      Result.inspectError(showSyncError),
    );
  };

  const handleSetupRetry = async () => {
    if (accountSetupState === null) {
      return;
    }

    await runAccountSetupSync({
      accountId: account.id,
      queryClient,
      t,
      onSyncStatusChanged,
    });
  };

  return {
    handleSyncUpdate,
    handleSyncNow,
    handleSetupRetry,
    syncIntervalOptions: [
      { value: "900", label: t("account.every_15_minutes") },
      { value: "1800", label: t("account.every_30_minutes") },
      { value: "3600", label: t("account.every_hour") },
      { value: "7200", label: t("account.every_2_hours") },
      { value: "14400", label: t("account.every_4_hours") },
      { value: "86400", label: t("account.once_a_day") },
    ],
    keepReadItemsOptions: [
      { value: "7", label: t("account.one_week") },
      { value: "14", label: t("account.two_weeks") },
      { value: "30", label: t("account.one_month") },
      { value: "60", label: t("account.sixty_days") },
      { value: "90", label: t("account.three_months") },
      { value: "180", label: t("account.six_months") },
      { value: "365", label: t("account.one_year") },
      { value: "0", label: t("account.forever") },
    ],
  };
}
