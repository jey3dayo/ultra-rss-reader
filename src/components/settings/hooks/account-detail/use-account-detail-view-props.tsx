import type { TFunction } from "i18next";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";
import type { AccountDetailSyncProgress, AccountSyncStatusRow } from "@/components/settings/account-detail/sync.types";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import type { AccountDetailViewProps } from "@/components/settings/account-detail/view";
import type { AccountSetupSessionState } from "@/lib/account/account-setup-session.types";
import { formatAccountLastSuccessLabel } from "@/lib/account/account-sync-status-format";
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
  accountSetupState?: AccountSetupSessionState | null;
  accountSetupErrorMessage?: string | null;
};

type AccountDetailViewPropsResult = Pick<
  AccountDetailViewProps,
  "title" | "subtitle" | "headerSummary" | "generalSection" | "credentialsSection" | "syncSection" | "dangerZone"
>;

function isFreshRssAccount(account: AccountDetailAccount): boolean {
  return account.kind === "FreshRss";
}

function isLocalAccount(account: AccountDetailAccount): boolean {
  return account.kind === "Local";
}

function isValidHttpServerUrl(value: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveAccountQuarantineReason(account: AccountDetailAccount, t: TFunction<"settings">): string | null {
  if (!isFreshRssAccount(account) && !isLocalAccount(account)) {
    return t("account.quarantine_invalid_provider_kind", {
      kind: account.kind,
    });
  }

  if (isFreshRssAccount(account) && !isValidHttpServerUrl(account.server_url)) {
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
  accountSetupState,
  accountSetupErrorMessage,
}: AccountDetailViewPropsParams): AccountDetailViewPropsResult {
  const isSetupSyncing = accountSetupState === "syncing";
  const isSetupFailed = accountSetupState === "failed";
  const isSetupActive = isSetupSyncing || isSetupFailed;
  const quarantineReason = resolveAccountQuarantineReason(account, t);
  const isQuarantined = quarantineReason !== null;
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
    generalSection: {
      heading: t("account.general"),
      nameLabel: t("account.description"),
      nameValue: account.name,
      editNameTitle: t("account.click_to_edit"),
      isEditingName: controller.editingName,
      isSavingName: controller.savingName,
      nameDraft: controller.nameDraft,
      nameInputRef: controller.nameInputRef,
      infoRows: [
        {
          label: t("account.type"),
          value: isFreshRssAccount(account)
            ? t("account.freshrss")
            : isLocalAccount(account)
              ? t("account.local")
              : account.kind,
        },
        ...(quarantineReason
          ? [
              {
                label: t("account.quarantine_state"),
                value: t("account.quarantine_state_value"),
              },
            ]
          : []),
        ...(!isValidHttpServerUrl(account.server_url)
          ? [
              {
                label: t("account.server_url"),
                value: account.server_url ?? "",
              },
            ]
          : []),
        ...(account.username
          ? [
              {
                label: t("account.username"),
                value: account.username,
              },
            ]
          : []),
        ...(quarantineReason
          ? [
              {
                label: t("account.quarantine_action"),
                value: t("account.quarantine_delete_action"),
              },
            ]
          : []),
        ...(isSetupFailed
          ? [
              {
                label: t("account.recovery_credentials_label"),
                value: t("account.recovery_credentials_detail"),
              },
              {
                label: t("account.recovery_server_url_label"),
                value: t("account.recovery_server_url_detail"),
              },
              {
                label: t("account.recovery_cache_label"),
                value: t("account.recovery_cache_detail"),
              },
            ]
          : []),
      ],
      onStartEditingName: controller.startEditingName,
      onNameDraftChange: controller.setNameDraft,
      onCommitName: controller.commitRename,
      onNameKeyDown: controller.handleNameKeyDown,
      disabled: isSetupActive || isQuarantined,
    },
    credentialsSection: isFreshRssAccount(account) ? (
      <AccountCredentialsSectionView
        heading={t("account.server")}
        note={
          isQuarantined
            ? t("account.quarantine_readonly_note")
            : isSetupFailed
              ? t("account.setup_failed_credentials_note")
              : undefined
        }
        disabled={isSetupSyncing || isQuarantined}
        serverUrlLabel={t("account.server_url")}
        serverUrlValue={controller.credServerUrl ?? account.server_url ?? ""}
        serverUrlPlaceholder={t("account.server_url_placeholder")}
        serverUrlInputRef={controller.serverUrlInputRef}
        serverUrlCopyLabel={t("account.copy_server_url")}
        onServerUrlChange={controller.setCredServerUrl}
        onServerUrlBlur={controller.commitCredentials}
        onServerUrlCopy={() => void controller.handleCopyServerUrl()}
        usernameLabel={t("account.username")}
        usernameValue={controller.credUsername ?? account.username ?? ""}
        usernameInputRef={controller.usernameInputRef}
        onUsernameChange={controller.setCredUsername}
        onUsernameBlur={controller.commitCredentials}
        passwordLabel={t("account.password")}
        passwordValue={controller.passwordDisplayValue}
        passwordPlaceholder={t("account.password_placeholder")}
        onPasswordChange={controller.setCredPassword}
        onPasswordFocus={controller.onPasswordFocus}
        onPasswordBlur={controller.commitCredentials}
        testConnectionLabel={isSetupActive || isQuarantined ? undefined : t("account.test_connection")}
        testingConnectionLabel={isSetupActive || isQuarantined ? undefined : t("account.testing_connection")}
        testConnectionTone={verificationStatus === "verified" ? "subtle" : "content"}
        onTestConnection={isSetupActive || isQuarantined ? undefined : controller.handleTestConnection}
        isTestingConnection={controller.testingConnection}
      />
    ) : undefined,
    syncSection: {
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
    },
    dangerZone: {
      dataHeading: t("account.data_section"),
      dangerHeading: t("account.danger_zone"),
      exportLabel: t("account.export_opml"),
      deleteLabel: t("account.delete_account"),
      onExport: controller.handleExportOpml,
      onRequestDelete: controller.handleRequestDelete,
      disabled: isSetupActive,
    },
  };
}
