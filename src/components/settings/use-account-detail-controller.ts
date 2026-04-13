import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { deleteAccount, exportOpml, syncAccount, updateAccountSync } from "@/api/tauri-commands";
import { resolveSyncFeedbackMessage, summarizeSyncResult } from "@/lib/sync-result-feedback";
import { useUiStore } from "@/stores/ui-store";
import type {
  UpdateAccountSyncParams,
  UseAccountDetailControllerParams,
  UseAccountDetailControllerResult,
} from "./account-detail.types";
import { useAccountDetailCredentialsEditor } from "./use-account-detail-credentials-editor";
import { useAccountDetailNameEditor } from "./use-account-detail-name-editor";

export function useAccountDetailController({
  account,
  t,
  onAccountDeleted,
  onSyncStatusChanged,
}: UseAccountDetailControllerParams): UseAccountDetailControllerResult {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameEditor = useAccountDetailNameEditor({
    account,
    queryClient: qc,
    t,
  });
  const credentialsEditor = useAccountDetailCredentialsEditor({
    account,
    queryClient: qc,
    t,
  });

  const handleSyncUpdate = async (partial: UpdateAccountSyncParams) => {
    Result.pipe(
      await updateAccountSync(
        account.id,
        partial.syncIntervalSecs ?? account.sync_interval_secs,
        partial.syncOnWake ?? account.sync_on_wake,
        partial.keepReadItemsDays ?? account.keep_read_items_days,
      ),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_update_sync", { message: e.message })),
      ),
      Result.inspect((updated) => {
        qc.setQueryData<AccountDto[]>(["accounts"], (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
      }),
    );
  };

  const handleSyncNow = async () => {
    const result = await syncAccount(account.id);
    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        qc.invalidateQueries({ queryKey: ["feeds"] });
        qc.invalidateQueries({ queryKey: ["articles"] });
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
      Result.inspectError((e) => {
        useUiStore.getState().showToast(t("account.sync_failed", { message: e.message }));
      }),
    );
  };

  const handleExportOpml = async () => {
    Result.pipe(
      await exportOpml(account.id),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_export_opml", { message: e.message })),
      ),
      Result.inspect((opmlString) => {
        const blob = new Blob([opmlString], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const safeName = account.name.replace(/[<>:"/\\|?*]/g, "_");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeName}-feeds.opml`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
    );
  };

  const handleDelete = async () => {
    Result.pipe(
      await deleteAccount(account.id),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_delete", { message: e.message })),
      ),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        onAccountDeleted();
      }),
    );
  };

  const syncIntervalOptions = [
    { value: "900", label: t("account.every_15_minutes") },
    { value: "1800", label: t("account.every_30_minutes") },
    { value: "3600", label: t("account.every_hour") },
    { value: "7200", label: t("account.every_2_hours") },
    { value: "14400", label: t("account.every_4_hours") },
    { value: "86400", label: t("account.once_a_day") },
  ];
  const keepReadItemsOptions = [
    { value: "7", label: t("account.one_week") },
    { value: "14", label: t("account.two_weeks") },
    { value: "30", label: t("account.one_month") },
    { value: "60", label: t("account.sixty_days") },
    { value: "90", label: t("account.three_months") },
    { value: "180", label: t("account.six_months") },
    { value: "365", label: t("account.one_year") },
    { value: "0", label: t("account.forever") },
  ];

  return {
    confirmDelete,
    setConfirmDelete,
    ...nameEditor,
    ...credentialsEditor,
    handleSyncUpdate,
    handleSyncNow,
    handleExportOpml,
    handleDelete,
    syncIntervalOptions,
    keepReadItemsOptions,
  };
}
