import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import { AccountCredentialsSectionView } from "@/components/settings/account-credentials-section-view";
import { formatAccountLastSuccessLabel } from "@/lib/account-sync-status-format";
import type { UseAccountDetailViewPropsParams, UseAccountDetailViewPropsResult } from "./account-detail.types";

export function useAccountDetailViewProps({
  account,
  controller,
  isSyncing,
  syncStatus,
  syncStatusRows,
  language,
  t,
}: UseAccountDetailViewPropsParams): UseAccountDetailViewPropsResult {
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
    },
    credentialsSection:
      account.kind === "FreshRss" ? (
        <AccountCredentialsSectionView
          heading={t("account.server")}
          serverUrlLabel={t("account.server_url")}
          serverUrlValue={controller.credServerUrl ?? account.server_url ?? ""}
          serverUrlPlaceholder={t("account.server_url_placeholder")}
          serverUrlCopyLabel={t("account.copy_server_url")}
          onServerUrlChange={controller.setCredServerUrl}
          onServerUrlBlur={controller.commitCredentials}
          onServerUrlCopy={() => void controller.handleCopyServerUrl()}
          usernameLabel={t("account.username")}
          usernameValue={controller.credUsername ?? account.username ?? ""}
          onUsernameChange={controller.setCredUsername}
          onUsernameBlur={controller.commitCredentials}
          passwordLabel={t("account.password")}
          passwordValue={controller.passwordDisplayValue}
          passwordPlaceholder={t("account.password_placeholder")}
          onPasswordChange={controller.setCredPassword}
          onPasswordFocus={controller.onPasswordFocus}
          onPasswordBlur={controller.commitCredentials}
          testConnectionLabel={t("account.test_connection")}
          testingConnectionLabel={t("account.testing_connection")}
          testConnectionVariant={verificationStatus === "verified" ? "secondary" : "default"}
          onTestConnection={controller.handleTestConnection}
          isTestingConnection={controller.testingConnection}
        />
      ) : undefined,
    syncSection: {
      heading: t("account.syncing"),
      syncInterval: {
        name: "sync-interval",
        label: t("account.sync"),
        value: String(account.sync_interval_secs),
        options: controller.syncIntervalOptions,
        onChange: (value) => controller.handleSyncUpdate({ syncIntervalSecs: Number(value) }),
      },
      syncOnStartup: {
        label: t("account.sync_on_startup"),
        checked: account.sync_on_startup,
        onChange: (value) => controller.handleSyncUpdate({ syncOnStartup: value }),
      },
      syncOnWake: {
        label: t("account.sync_on_wake"),
        checked: account.sync_on_wake,
        onChange: (value) => controller.handleSyncUpdate({ syncOnWake: value }),
      },
      keepReadItems: {
        name: "keep-read-items",
        label: t("account.keep_read_items"),
        value: String(account.keep_read_items_days),
        options: controller.keepReadItemsOptions,
        onChange: (value) => controller.handleSyncUpdate({ keepReadItemsDays: Number(value) }),
      },
      statusRows: syncStatusRows,
      syncNowLabel: t("account.sync_now"),
      syncingLabel: t("account.syncing_now"),
      onSyncNow: controller.handleSyncNow,
      isSyncing,
    },
    dangerZone: {
      dataHeading: t("account.data_section"),
      dangerHeading: t("account.danger_zone"),
      exportLabel: t("account.export_opml"),
      deleteLabel: t("account.delete_account"),
      onExport: controller.handleExportOpml,
      onRequestDelete: controller.handleRequestDelete,
    },
  };
}
