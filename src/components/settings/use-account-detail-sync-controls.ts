import { Result } from "@praha/byethrow";
import { syncAccount, updateAccountSync } from "@/api/tauri-commands";
import { resolveSyncFeedbackMessage, summarizeSyncResult } from "@/lib/sync-result-feedback";
import { useUiStore } from "@/stores/ui-store";
import type {
  UpdateAccountSyncParams,
  UseAccountDetailSyncControlsParams,
  UseAccountDetailSyncControlsResult,
} from "./account-detail.types";
import { updateCachedAccount } from "./account-detail-query-cache";

export function useAccountDetailSyncControls({
  account,
  queryClient,
  t,
  onSyncStatusChanged,
}: UseAccountDetailSyncControlsParams): UseAccountDetailSyncControlsResult {
  const handleSyncUpdate = async (partial: UpdateAccountSyncParams) => {
    Result.pipe(
      await updateAccountSync(
        account.id,
        partial.syncIntervalSecs ?? account.sync_interval_secs,
        partial.syncOnWake ?? account.sync_on_wake,
        partial.keepReadItemsDays ?? account.keep_read_items_days,
      ),
      Result.inspectError((error) =>
        useUiStore.getState().showToast(t("account.failed_to_update_sync", { message: error.message })),
      ),
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
        queryClient.invalidateQueries({ queryKey: ["feeds"] });
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
      Result.inspectError((error) => {
        useUiStore.getState().showToast(t("account.sync_failed", { message: error.message }));
      }),
    );
  };

  return {
    handleSyncUpdate,
    handleSyncNow,
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
