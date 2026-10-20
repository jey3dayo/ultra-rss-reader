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

type SyncPhase = "quarantined" | "setup-syncing" | "setup-failed" | "idle";

const SYNC_HEADING_KEYS = {
  quarantined: "account.quarantine_heading",
  "setup-syncing": "account.setup_syncing_heading",
  "setup-failed": "account.setup_failed_heading",
  idle: "account.syncing",
} as const satisfies Record<SyncPhase, string>;

const SYNC_NOTE_KEYS = {
  quarantined: "account.quarantine_readonly_note",
  "setup-syncing": "account.setup_syncing_description",
  "setup-failed": "account.setup_failed_description",
  idle: undefined,
} as const satisfies Record<SyncPhase, string | undefined>;

function resolveSyncPhase({
  isQuarantined,
  isSetupSyncing,
  isSetupFailed,
}: Pick<BuildSyncSectionParams, "isQuarantined" | "isSetupSyncing" | "isSetupFailed">): SyncPhase {
  if (isQuarantined) return "quarantined";
  if (isSetupSyncing) return "setup-syncing";
  if (isSetupFailed) return "setup-failed";
  return "idle";
}

function buildSyncProgress({
  isSyncing,
  syncProgress,
  t,
}: Pick<BuildSyncSectionParams, "isSyncing" | "syncProgress" | "t">) {
  const hasTotal = isSyncing && syncProgress !== undefined && syncProgress.total > 0;
  return {
    progressValue: hasTotal
      ? Math.max((syncProgress.completed / syncProgress.total) * 100, syncProgress.completed === 0 ? 8 : 0)
      : null,
    progressLabel: hasTotal
      ? t("account.sync_progress_summary", { completed: syncProgress.completed, total: syncProgress.total })
      : isSyncing
        ? t("account.sync_progress_preparing")
        : undefined,
    progressCurrentLabel:
      isSyncing && syncProgress?.currentAccountName
        ? t("account.sync_progress_current_account", { name: syncProgress.currentAccountName })
        : undefined,
  };
}

function buildSyncSettingControls(
  account: AccountDetailAccount,
  controller: AccountDetailControllerResult,
  t: TFunction<"settings">,
  disabled: boolean,
): Pick<SyncSectionProps, "syncInterval" | "syncOnStartup" | "syncOnWake" | "keepReadItems"> {
  return {
    syncInterval: {
      name: "sync-interval",
      label: t("account.sync"),
      value: String(account.sync_interval_secs),
      options: controller.syncIntervalOptions,
      onChange: (value) => controller.handleSyncUpdate({ syncIntervalSecs: Number(value) }),
      disabled,
    },
    syncOnStartup: {
      label: t("account.sync_on_startup"),
      checked: account.sync_on_startup,
      onChange: (value) => controller.handleSyncUpdate({ syncOnStartup: value }),
      disabled,
    },
    syncOnWake: {
      label: t("account.sync_on_wake"),
      checked: account.sync_on_wake,
      onChange: (value) => controller.handleSyncUpdate({ syncOnWake: value }),
      disabled,
    },
    keepReadItems: {
      name: "keep-read-items",
      label: t("account.keep_read_items"),
      value: String(account.keep_read_items_days),
      options: controller.keepReadItemsOptions,
      onChange: (value) => controller.handleSyncUpdate({ keepReadItemsDays: Number(value) }),
      disabled,
    },
  };
}

function resolveSyncNowHandler(
  controller: AccountDetailControllerResult,
  isQuarantined: boolean,
  isSetupActive: boolean,
): SyncSectionProps["onSyncNow"] {
  if (isQuarantined) return undefined;
  return isSetupActive ? controller.handleSetupRetry : controller.handleSyncNow;
}

function buildSecondaryAction(
  controller: AccountDetailControllerResult,
  t: TFunction<"settings">,
  showEditCredentials: boolean,
  showTestConnection: boolean,
): Pick<SyncSectionProps, "secondaryActionLabel" | "onSecondaryAction"> {
  if (showEditCredentials) {
    return {
      secondaryActionLabel: t("account.setup_edit_credentials"),
      onSecondaryAction: controller.focusCredentialsEditor,
    };
  }
  if (showTestConnection) {
    return {
      secondaryActionLabel: t("account.test_connection"),
      onSecondaryAction: controller.handleTestConnection,
    };
  }
  return {
    secondaryActionLabel: undefined,
    onSecondaryAction: undefined,
  };
}

function buildDevCredentialsRecovery(
  controller: AccountDetailControllerResult,
  t: TFunction<"settings">,
  canShow: boolean,
): Pick<
  SyncSectionProps,
  | "devCredentialsRecoveryActionLabel"
  | "devCredentialsRecoveryLoadingLabel"
  | "onDevCredentialsRecoveryAction"
  | "isDevCredentialsRecoveryInFlight"
> {
  return {
    devCredentialsRecoveryActionLabel: canShow ? t("account.dev_credentials_recovery_action") : undefined,
    devCredentialsRecoveryLoadingLabel: canShow ? t("account.dev_credentials_recovery_loading") : undefined,
    onDevCredentialsRecoveryAction: canShow ? controller.handleResetDevCredentials : undefined,
    isDevCredentialsRecoveryInFlight: controller.devCredentialsRecoveryInFlight,
  };
}

function resolveSyncNote(
  phase: SyncPhase,
  accountSetupErrorMessage: string | null | undefined,
  t: TFunction<"settings">,
): SyncSectionProps["note"] {
  if (phase === "setup-failed" && accountSetupErrorMessage != null) return accountSetupErrorMessage;
  const noteKey = SYNC_NOTE_KEYS[phase];
  return noteKey && t(noteKey);
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
  const phase = resolveSyncPhase({ isQuarantined, isSetupSyncing, isSetupFailed });
  const isWaitingForCredentialAccess = syncStatus?.waiting_for_credential_access === true;
  const { progressValue, progressLabel, progressCurrentLabel } = buildSyncProgress({ isSyncing, syncProgress, t });

  return {
    heading: t(SYNC_HEADING_KEYS[phase]),
    note: resolveSyncNote(phase, accountSetupErrorMessage, t),
    progressLabel,
    progressValue,
    progressCurrentLabel,
    ...buildSyncSettingControls(account, controller, t, isSetupActive || isQuarantined),
    statusRows: syncStatusRows,
    syncNowLabel: isSetupFailed ? t("account.setup_retry") : t("account.sync_now"),
    syncNowSuccessLabel: t("account.sync_now_succeeded"),
    syncNowSucceeded: !isSetupActive && controller.syncNowSucceeded,
    syncingLabel: isSetupSyncing ? t("account.setup_syncing_action") : t("account.syncing_now"),
    onSyncNow: resolveSyncNowHandler(controller, isQuarantined, isSetupActive),
    isSyncing: isSyncing || controller.syncActionInFlight,
    ...buildSecondaryAction(
      controller,
      t,
      isSetupFailed && !isQuarantined,
      isWaitingForCredentialAccess && !isQuarantined && !isSetupActive,
    ),
    ...buildDevCredentialsRecovery(controller, t, canShowDevCredentialsRecovery),
  };
}
