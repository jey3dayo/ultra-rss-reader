import type { TFunction } from "i18next";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";
import type {
  AccountDetailAccount,
  AccountDetailSyncProgress,
  AccountDetailViewProps,
  AccountSyncStatusRow,
} from "@/components/settings/account-detail/types";
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
  "title" | "headerSummary" | "generalSection" | "credentialsSection" | "syncSection" | "dangerZone"
>;

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
          value: account.kind === "FreshRss" ? t("account.freshrss") : t("account.local"),
        },
      ],
      onStartEditingName: controller.startEditingName,
      onNameDraftChange: controller.setNameDraft,
      onCommitName: controller.commitRename,
      onNameKeyDown: controller.handleNameKeyDown,
      disabled: isSetupActive,
    },
    credentialsSection:
      account.kind === "FreshRss" ? (
        <AccountCredentialsSectionView
          heading={t("account.server")}
          note={isSetupFailed ? t("account.setup_failed_credentials_note") : undefined}
          disabled={isSetupSyncing}
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
          testConnectionLabel={isSetupActive ? undefined : t("account.test_connection")}
          testingConnectionLabel={isSetupActive ? undefined : t("account.testing_connection")}
          testConnectionTone={verificationStatus === "verified" ? "subtle" : "content"}
          onTestConnection={isSetupActive ? undefined : controller.handleTestConnection}
          isTestingConnection={controller.testingConnection}
        />
      ) : undefined,
    syncSection: {
      heading: isSetupSyncing
        ? t("account.setup_syncing_heading")
        : isSetupFailed
          ? t("account.setup_failed_heading")
          : t("account.syncing"),
      note: isSetupSyncing
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
        disabled: isSetupActive,
      },
      syncOnStartup: {
        label: t("account.sync_on_startup"),
        checked: account.sync_on_startup,
        onChange: (value) => controller.handleSyncUpdate({ syncOnStartup: value }),
        disabled: isSetupActive,
      },
      syncOnWake: {
        label: t("account.sync_on_wake"),
        checked: account.sync_on_wake,
        onChange: (value) => controller.handleSyncUpdate({ syncOnWake: value }),
        disabled: isSetupActive,
      },
      keepReadItems: {
        name: "keep-read-items",
        label: t("account.keep_read_items"),
        value: String(account.keep_read_items_days),
        options: controller.keepReadItemsOptions,
        onChange: (value) => controller.handleSyncUpdate({ keepReadItemsDays: Number(value) }),
        disabled: isSetupActive,
      },
      statusRows: syncStatusRows,
      syncNowLabel: isSetupFailed ? t("account.setup_retry") : t("account.sync_now"),
      syncingLabel: isSetupSyncing ? t("account.setup_syncing_action") : t("account.syncing_now"),
      onSyncNow: isSetupActive ? controller.handleSetupRetry : controller.handleSyncNow,
      isSyncing,
      secondaryActionLabel: isSetupFailed ? t("account.setup_edit_credentials") : undefined,
      onSecondaryAction: isSetupFailed ? controller.focusCredentialsEditor : undefined,
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
