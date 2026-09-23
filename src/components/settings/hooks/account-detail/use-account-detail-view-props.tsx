import type { TFunction } from "i18next";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import type { AccountDetailSyncProgress } from "@/components/settings/account-detail/account-detail";
import type { AccountSyncStatusRow } from "@/components/settings/account-detail/sync-section-view";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import type { AccountDetailViewProps } from "@/components/settings/account-detail/view";
import type { AccountSetupSessionState } from "@/lib/account/account-setup-session.types";
import { isValidOptionalHttpServerUrl } from "@/lib/account/server-url";
import { isFreshRssAccount, isLocalAccount } from "./account-kind";
import { buildCredentialsSection } from "./build-credentials-section";
import { buildDangerZoneSection } from "./build-danger-zone-section";
import { buildGeneralSection } from "./build-general-section";
import { buildHeaderSummary } from "./build-header-summary";
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
  const verificationStatus = account.connection_verification_status ?? "unverified";
  const headerSummary = buildHeaderSummary({ account, verificationStatus, syncStatus, language, t });

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
      syncProgress,
      syncStatus,
      canRecoverDevCredentialsStore,
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
