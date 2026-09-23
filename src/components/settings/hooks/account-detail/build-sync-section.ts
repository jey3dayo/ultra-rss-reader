import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import type { AccountDetailSyncProgress } from "@/components/settings/account-detail/account-detail";
import type {
  AccountSyncSectionView,
  AccountSyncStatusRow,
} from "@/components/settings/account-detail/sync-section-view";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type SyncSectionProps = ComponentProps<typeof AccountSyncSectionView>;

type BuildSyncSectionParams = {
  account: AccountDetailAccount;
  controller: AccountDetailControllerResult;
  t: TFunction<"settings">;
  syncStatusRows: AccountSyncStatusRow[];
  accountSetupErrorMessage?: string | null;
  isSyncing: boolean;
  syncProgress?: AccountDetailSyncProgress;
  syncStatus: AccountSyncStatusDto | undefined;
  canRecoverDevCredentialsStore: boolean;
  isSetupSyncing: boolean;
  isSetupFailed: boolean;
  isSetupActive: boolean;
  isQuarantined: boolean;
};

function hasOversizedDevCredentialsStoreError(syncStatus: AccountSyncStatusDto | undefined): boolean {
  return syncStatus?.last_error?.includes("Dev store exceeds maximum size") === true;
}

export function buildSyncSection({
  account,
  controller,
  t,
  syncStatusRows,
  accountSetupErrorMessage,
  isSyncing,
  syncProgress,
  syncStatus,
  canRecoverDevCredentialsStore,
  isSetupSyncing,
  isSetupFailed,
  isSetupActive,
  isQuarantined,
}: BuildSyncSectionParams): SyncSectionProps {
  const canShowDevCredentialsRecovery =
    canRecoverDevCredentialsStore && !isQuarantined && hasOversizedDevCredentialsStoreError(syncStatus);
  const progressValue =
    isSyncing && syncProgress && syncProgress.total > 0
      ? Math.max((syncProgress.completed / syncProgress.total) * 100, syncProgress.completed === 0 ? 8 : 0)
      : null;
  const progressLabel =
    isSyncing && syncProgress && syncProgress.total > 0
      ? t("account.sync_progress_summary", {
          completed: syncProgress.completed,
          total: syncProgress.total,
        })
      : isSyncing
        ? t("account.sync_progress_preparing")
        : undefined;
  const progressCurrentLabel =
    isSyncing && syncProgress?.currentAccountName
      ? t("account.sync_progress_current_account", {
          name: syncProgress.currentAccountName,
        })
      : undefined;

  return {
    heading: isQuarantined
      ? t("account.quarantine_heading")
      : isSetupSyncing
        ? t("account.setup_syncing_heading")
        : isSetupFailed
          ? t("account.setup_failed_heading")
          : t("account.syncing"),
    note: isQuarantined
      ? t("account.quarantine_readonly_note")
      : isSetupSyncing
        ? t("account.setup_syncing_description")
        : isSetupFailed
          ? (accountSetupErrorMessage ?? t("account.setup_failed_description"))
          : undefined,
    progressLabel,
    progressValue,
    progressCurrentLabel,
    syncInterval: {
      name: "sync-interval",
      label: t("account.sync"),
      value: String(account.sync_interval_secs),
      options: controller.syncIntervalOptions,
      onChange: (value) => controller.handleSyncUpdate({ syncIntervalSecs: Number(value) }),
      disabled: isSetupActive || isQuarantined,
    },
    syncOnStartup: {
      label: t("account.sync_on_startup"),
      checked: account.sync_on_startup,
      onChange: (value) => controller.handleSyncUpdate({ syncOnStartup: value }),
      disabled: isSetupActive || isQuarantined,
    },
    syncOnWake: {
      label: t("account.sync_on_wake"),
      checked: account.sync_on_wake,
      onChange: (value) => controller.handleSyncUpdate({ syncOnWake: value }),
      disabled: isSetupActive || isQuarantined,
    },
    keepReadItems: {
      name: "keep-read-items",
      label: t("account.keep_read_items"),
      value: String(account.keep_read_items_days),
      options: controller.keepReadItemsOptions,
      onChange: (value) => controller.handleSyncUpdate({ keepReadItemsDays: Number(value) }),
      disabled: isSetupActive || isQuarantined,
    },
    statusRows: syncStatusRows,
    syncNowLabel: isSetupFailed ? t("account.setup_retry") : t("account.sync_now"),
    syncingLabel: isSetupSyncing ? t("account.setup_syncing_action") : t("account.syncing_now"),
    onSyncNow: isQuarantined ? undefined : isSetupActive ? controller.handleSetupRetry : controller.handleSyncNow,
    isSyncing: isSyncing || controller.syncActionInFlight,
    secondaryActionLabel: isSetupFailed && !isQuarantined ? t("account.setup_edit_credentials") : undefined,
    onSecondaryAction: isSetupFailed && !isQuarantined ? controller.focusCredentialsEditor : undefined,
    devCredentialsRecoveryActionLabel: canShowDevCredentialsRecovery
      ? t("account.dev_credentials_recovery_action")
      : undefined,
    devCredentialsRecoveryLoadingLabel: canShowDevCredentialsRecovery
      ? t("account.dev_credentials_recovery_loading")
      : undefined,
    onDevCredentialsRecoveryAction: canShowDevCredentialsRecovery ? controller.handleResetDevCredentials : undefined,
    isDevCredentialsRecoveryInFlight: controller.devCredentialsRecoveryInFlight,
  };
}
