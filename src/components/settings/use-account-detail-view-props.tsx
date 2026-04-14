import { AccountCredentialsSectionView } from "@/components/settings/account-credentials-section-view";
import type { UseAccountDetailViewPropsParams, UseAccountDetailViewPropsResult } from "./account-detail.types";

export function useAccountDetailViewProps({
  account,
  controller,
  isSyncing,
  syncStatusRows,
  t,
  tc,
}: UseAccountDetailViewPropsParams): UseAccountDetailViewPropsResult {
  return {
    title: account.name,
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
          value:
            account.kind === "FreshRss"
              ? t("account.freshrss")
              : account.kind === "Inoreader"
                ? t("account.inoreader")
                : t("account.local"),
        },
      ],
      onStartEditingName: controller.startEditingName,
      onNameDraftChange: controller.setNameDraft,
      onCommitName: controller.commitRename,
      onNameKeyDown: controller.handleNameKeyDown,
    },
    credentialsSection:
      account.kind === "FreshRss" || account.kind === "Inoreader" ? (
        <AccountCredentialsSectionView
          heading={account.kind === "FreshRss" ? t("account.server") : t("account.credentials")}
          serverUrlLabel={account.kind === "FreshRss" ? t("account.server_url") : undefined}
          serverUrlValue={controller.credServerUrl ?? account.server_url ?? ""}
          serverUrlPlaceholder={t("account.server_url_placeholder")}
          serverUrlCopyLabel={t("account.copy_server_url")}
          onServerUrlChange={account.kind === "FreshRss" ? controller.setCredServerUrl : undefined}
          onServerUrlBlur={controller.commitCredentials}
          onServerUrlCopy={account.kind === "FreshRss" ? () => void controller.handleCopyServerUrl() : undefined}
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
      deleteLabel: !controller.confirmDelete ? t("account.delete_account") : tc("delete"),
      cancelLabel: tc("cancel"),
      confirmDeleteLabel: t("account.confirm_delete"),
      isConfirmingDelete: controller.confirmDelete,
      onExport: controller.handleExportOpml,
      onRequestDelete: () => controller.setConfirmDelete(true),
      onConfirmDelete: controller.handleDelete,
      onCancelDelete: () => controller.setConfirmDelete(false),
    },
  };
}
