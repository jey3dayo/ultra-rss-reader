import type { TFunction } from "i18next";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import type { AccountDetailSyncProgress } from "@/components/settings/account-detail/account-detail";
import type { AccountSyncStatusRow } from "@/components/settings/account-detail/sync-section-view";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import type { AccountDetailViewProps } from "@/components/settings/account-detail/view";
import type { AccountSetupSessionState } from "@/lib/account/account-setup-session.types";
import { formatAccountLastSuccessLabel } from "@/lib/account/account-sync-status-format";
import { isValidOptionalHttpServerUrl } from "@/lib/account/server-url";
import { isFreshRssAccount, isLocalAccount } from "./account-kind";
import { buildCredentialsSection } from "./build-credentials-section";
import { buildDangerZoneSection } from "./build-danger-zone-section";
import { buildGeneralSection } from "./build-general-section";
import { buildSyncSection } from "./build-sync-section";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type AccountDetailViewPropsParams = {
  account: AccountDetailAccount;
  controller: AccountDetailControllerResult;
  isSyncing: boolean;
  syncProgress?: AccountDetailSyncProgress;
  syncStatus: AccountSyncStatusDto | undefined;
  syncStatusRows: AccountSyncStatusRow[];
  language: string;
  t: TFunction<"settings">;
  canRecoverDevCredentialsStore: boolean;
  accountSetupState?: AccountSetupSessionState | null;
  accountSetupErrorMessage?: string | null;
};

type AccountDetailViewPropsResult = Pick<
  AccountDetailViewProps,
  "title" | "subtitle" | "headerSummary" | "generalSection" | "credentialsSection" | "syncSection" | "dangerZone"
>;

function resolveAccountQuarantineReason(account: AccountDetailAccount, t: TFunction<"settings">): string | null {
  if (!isFreshRssAccount(account) && !isLocalAccount(account)) {
    return t("account.quarantine_invalid_provider_kind", {
      kind: account.kind,
    });
  }

  if (isFreshRssAccount(account) && !isValidOptionalHttpServerUrl(account.server_url)) {
    return t("account.quarantine_invalid_server_url");
  }

  return null;
}

function hasOversizedDevCredentialsStoreError(syncStatus: AccountSyncStatusDto | undefined): boolean {
  return syncStatus?.last_error?.includes("Dev store exceeds maximum size") === true;
}

export function useAccountDetailViewProps({
  account,
  controller,
  isSyncing,
  syncProgress,
  syncStatus,
  syncStatusRows,
  language,
  t,
  canRecoverDevCredentialsStore,
  accountSetupState,
  accountSetupErrorMessage,
}: AccountDetailViewPropsParams): AccountDetailViewPropsResult {
  const isSetupSyncing = accountSetupState === "syncing";
  const isSetupFailed = accountSetupState === "failed";
  const isSetupActive = isSetupSyncing || isSetupFailed;
  const quarantineReason = resolveAccountQuarantineReason(account, t);
  const isQuarantined = quarantineReason !== null;
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
  const verificationStatus = account.connection_verification_status ?? "unverified";
  const lastSuccessLabel = formatAccountLastSuccessLabel(syncStatus?.last_success_at ?? undefined, language);
  const summaryDetail = lastSuccessLabel
    ? lastSuccessLabel.isToday
      ? t("account.synced_today_at", { time: lastSuccessLabel.time })
      : t("account.synced_date_at", {
          date: lastSuccessLabel.date,
          time: lastSuccessLabel.time,
        })
    : verificationStatus === "error"
      ? t("account.connection_auth_failed_summary")
      : syncStatus?.last_error
        ? t("account.connection_fetch_failed_summary")
        : t("account.connection_not_fetched_summary");
  const headerSummary =
    account.kind === "FreshRss" ? (
      <AccountConnectionSummary
        statusLabel={
          verificationStatus === "verified"
            ? t("account.connection_verified_status")
            : verificationStatus === "error"
              ? t("account.connection_error_status")
              : t("account.connection_unverified_status")
        }
        statusTone={
          verificationStatus === "verified" ? "success" : verificationStatus === "error" ? "danger" : "warning"
        }
        detail={summaryDetail}
      />
    ) : undefined;

  return {
    title: account.name,
    subtitle: quarantineReason ?? undefined,
    headerSummary,
    generalSection: buildGeneralSection({
      account,
      controller,
      t,
      quarantineReason,
      isSetupFailed,
      isSetupActive,
      isQuarantined,
    }),
    credentialsSection: buildCredentialsSection({
      account,
      controller,
      t,
      verificationStatus,
      isSetupSyncing,
      isSetupFailed,
      isSetupActive,
      isQuarantined,
    }),
    syncSection: buildSyncSection({
      account,
      controller,
      t,
      syncStatusRows,
      accountSetupErrorMessage,
      isSyncing,
      progressLabel,
      progressValue,
      progressCurrentLabel,
      canShowDevCredentialsRecovery,
      isSetupSyncing,
      isSetupFailed,
      isSetupActive,
      isQuarantined,
    }),
    dangerZone: buildDangerZoneSection({
      account,
      controller,
      t,
      isSetupActive,
    }),
  };
}
