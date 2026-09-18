import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import type { AccountDangerZoneView } from "@/components/settings/account-detail/danger-zone-view";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { isLocalAccount } from "./account-kind";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type DangerZoneProps = ComponentProps<typeof AccountDangerZoneView>;

type BuildDangerZoneSectionParams = {
  account: AccountDetailAccount;
  controller: AccountDetailControllerResult;
  t: TFunction<"settings">;
  isSetupActive: boolean;
};

export function buildDangerZoneSection({
  account,
  controller,
  t,
  isSetupActive,
}: BuildDangerZoneSectionParams): DangerZoneProps {
  return {
    dataHeading: t("account.data_section"),
    dangerHeading: t("account.danger_zone"),
    importLabel: t("account.import_opml"),
    importingLabel: t("account.importing_opml"),
    exportLabel: t("account.export_opml"),
    exportingLabel: t("account.exporting_opml"),
    localSyncHeading: isLocalAccount(account) ? t("account.local_sync_heading") : undefined,
    localSyncDescription: isLocalAccount(account) ? t("account.local_sync_description") : undefined,
    localSyncEnabledLabel: isLocalAccount(account) ? t("account.local_sync_enabled_label") : undefined,
    localSyncEnabledDescription: isLocalAccount(account) ? t("account.local_sync_enabled_description") : undefined,
    localSyncEnabledChecked: controller.localSyncEnabled,
    onLocalSyncEnabledChange: controller.handleToggleLocalSyncEnabled,
    localSyncFolderLabel: isLocalAccount(account) ? t("account.local_sync_folder") : undefined,
    localSyncFolderPlaceholder: isLocalAccount(account) ? t("account.local_sync_folder_placeholder") : undefined,
    localSyncFolderValue: controller.localSyncFolderPath,
    onLocalSyncFolderChange: controller.setLocalSyncFolderPath,
    saveLocalSyncFolderLabel: isLocalAccount(account) ? t("account.local_sync_save") : undefined,
    savingLocalSyncFolderLabel: isLocalAccount(account) ? t("account.local_sync_saving") : undefined,
    exportLocalSyncLabel: isLocalAccount(account) ? t("account.local_sync_export") : undefined,
    exportingLocalSyncLabel: isLocalAccount(account) ? t("account.local_sync_exporting") : undefined,
    importLocalSyncLabel: isLocalAccount(account) ? t("account.local_sync_import") : undefined,
    importingLocalSyncLabel: isLocalAccount(account) ? t("account.local_sync_importing") : undefined,
    onSaveLocalSyncFolder: controller.handleSaveLocalSyncFolder,
    onExportLocalSync: controller.handleExportLocalSyncOperations,
    onImportLocalSync: controller.handleImportLocalSyncOperations,
    loadingLocalSyncFolder: controller.loadingLocalSyncSettings,
    savingLocalSyncFolder: controller.savingLocalSyncSettings,
    exportingLocalSync: controller.exportingLocalSyncOperations,
    importingLocalSync: controller.importingLocalSyncOperations,
    deleteLabel: t("account.delete_account"),
    onImport: controller.handleImportOpml,
    onExport: controller.handleExportOpml,
    onRequestDelete: controller.handleRequestDelete,
    importing: controller.importingOpml,
    exporting: controller.exportingOpml,
    disabled: isSetupActive,
  };
}
