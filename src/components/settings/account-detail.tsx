import { useTranslation } from "react-i18next";
import { AccountCredentialsSectionView } from "@/components/settings/account-credentials-section-view";
import { AccountDetailView } from "@/components/settings/account-detail-view";
import { useAccountDetailController } from "@/components/settings/use-account-detail-controller";
import { useAccounts } from "@/hooks/use-accounts";
import { useUiStore } from "@/stores/ui-store";

function AccountDetailContent({
  account,
  isSyncing,
}: {
  account: NonNullable<ReturnType<typeof useAccounts>["data"]>[number];
  isSyncing: boolean;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const controller = useAccountDetailController({
    account,
    t,
    onAccountDeleted: () => setSettingsAccountId(null),
  });

  return (
    <AccountDetailView
      title={account.name}
      generalSection={{
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
      }}
      credentialsSection={
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
            passwordValue={controller.credPassword ?? ""}
            passwordPlaceholder={t("account.password_placeholder")}
            onPasswordChange={controller.setCredPassword}
            onPasswordFocus={controller.onPasswordFocus}
            onPasswordBlur={controller.commitCredentials}
            testConnectionLabel={t("account.test_connection")}
            testingConnectionLabel={t("account.testing_connection")}
            onTestConnection={controller.handleTestConnection}
            isTestingConnection={controller.testingConnection}
          />
        ) : undefined
      }
      syncSection={{
        heading: t("account.syncing"),
        syncInterval: {
          name: "sync-interval",
          label: t("account.sync"),
          value: String(account.sync_interval_secs),
          options: controller.syncIntervalOptions,
          onChange: (value) => controller.handleSyncUpdate({ syncIntervalSecs: Number(value) }),
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
        syncNowLabel: t("account.sync_now"),
        syncingLabel: t("account.syncing_now"),
        onSyncNow: controller.handleSyncNow,
        isSyncing,
      }}
      dangerZone={{
        exportLabel: t("account.export_opml"),
        deleteLabel: !controller.confirmDelete ? t("account.delete_account") : tc("delete"),
        cancelLabel: tc("cancel"),
        confirmDeleteLabel: t("account.confirm_delete"),
        isConfirmingDelete: controller.confirmDelete,
        onExport: controller.handleExportOpml,
        onRequestDelete: () => controller.setConfirmDelete(true),
        onConfirmDelete: controller.handleDelete,
        onCancelDelete: () => controller.setConfirmDelete(false),
      }}
    />
  );
}

export function AccountDetail() {
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const syncProgress = useUiStore((s) => s.syncProgress);
  const { data: accounts } = useAccounts();

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

  const isSyncing =
    syncProgress.active && (syncProgress.kind !== "manual_account" || syncProgress.activeAccountIds.has(account.id));

  return <AccountDetailContent account={account} isSyncing={isSyncing} />;
}
