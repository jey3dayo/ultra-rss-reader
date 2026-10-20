import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CredentialStorageSectionView } from "@/components/settings/credential-storage-section-view";
import { DataSettingsView } from "@/components/settings/data-settings-view";
import { useUiStore } from "@/stores/ui-store";
import { useCredentialStorageSetting } from "./hooks/use-credential-storage-setting";
import { useDataSettingsController } from "./hooks/use-data-settings-controller";
import { useRegisterSettingsDirtyState } from "./hooks/use-settings-dirty-state-registry";

export function DataSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((s) => s.showToast);
  const setSettingsLoading = useUiStore((s) => s.setSettingsLoading);
  const controller = useDataSettingsController({
    t,
    showToast,
    setSettingsLoading,
  });
  const credentialStorage = useCredentialStorageSetting({ t, showToast });
  const credentialStorageSection: ReactNode = (
    <CredentialStorageSectionView
      heading={t("data.credential_storage_heading")}
      label={t("data.credential_storage_label")}
      description={t("data.credential_storage_description")}
      osKeychainLabel={t("data.credential_storage_os_keychain")}
      localFileLabel={t("data.credential_storage_local_file")}
      localFileWarning={t("data.credential_storage_local_file_warning")}
      storage={credentialStorage.storage}
      loaded={credentialStorage.loaded}
      configurable={credentialStorage.configurable}
      saving={credentialStorage.saving}
      onStorageChange={(next) => void credentialStorage.handleChange(next)}
    />
  );
  const dataActionPending =
    controller.vacuuming ||
    controller.backingUp ||
    controller.openingLogDir ||
    controller.exportingSettingsProfile ||
    controller.importingSettingsProfile ||
    credentialStorage.saving;
  const safetyChecklist = t("data.safety_checklist", {
    returnObjects: true,
  }) as string[];

  useRegisterSettingsDirtyState({
    owner: "data",
    dirty: false,
    pending: dataActionPending,
    blockingReason: dataActionPending ? "data-action-pending" : null,
  });

  return (
    <DataSettingsView
      title={t("data.heading")}
      databaseHeading={t("data.database")}
      credentialStorageSection={credentialStorageSection}
      databaseSizeLabel={t("data.database_size")}
      databaseSizeStatus={controller.databaseSizeStatus}
      databaseSizeValue={controller.databaseSizeValue}
      databaseSizeLoadingLabel={t("data.database_size_loading")}
      databaseSizeErrorLabel={t("data.database_size_error")}
      safetyHeading={t("data.safety")}
      safetySummary={t("data.safety_summary")}
      safetyDescription={t("data.safety_description")}
      safetyChecklist={safetyChecklist}
      safetyInfoAriaLabel={t("data.safety_info_aria_label")}
      backupLabel={t("data.backup")}
      backupSummary={t("data.backup_summary")}
      backupDescription={t("data.backup_description")}
      backupInfoAriaLabel={t("data.backup_info_aria_label")}
      backupActionLabel={controller.backingUp ? t("data.backing_up") : t("data.backup_action")}
      backingUp={controller.backingUp}
      settingsProfileHeading={t("data.settings_profile")}
      settingsProfileDescription={t("data.settings_profile_description")}
      settingsProfilePrivacyWarning={t("data.settings_profile_privacy_warning")}
      settingsProfileInfoAriaLabel={t("data.settings_profile_info_aria_label")}
      settingsProfileImportLabel={t("data.settings_profile_import")}
      settingsProfileImportActionLabel={
        controller.importingSettingsProfile ? t("data.settings_profile_importing") : t("data.settings_profile_import")
      }
      settingsProfileExportLabel={t("data.settings_profile_export")}
      settingsProfileExportActionLabel={
        controller.exportingSettingsProfile ? t("data.settings_profile_exporting") : t("data.settings_profile_export")
      }
      settingsProfileFileInputLabel={t("data.settings_profile_file_input")}
      importingSettingsProfile={controller.importingSettingsProfile}
      exportingSettingsProfile={controller.exportingSettingsProfile}
      optimizationHeading={t("data.optimization")}
      vacuumSummary={t("data.vacuum_summary")}
      vacuumDescription={t("data.vacuum_description")}
      vacuumInfoAriaLabel={t("data.vacuum_info_aria_label")}
      vacuumLabel={t("data.vacuum")}
      vacuumActionLabel={controller.vacuuming ? t("data.vacuuming") : t("data.vacuum")}
      vacuuming={controller.vacuuming}
      logsHeading={t("data.logs")}
      openLogDirDescription={t("data.open_log_dir_description")}
      openLogDirLabel={t("data.open_log_dir")}
      openLogDirActionLabel={controller.openingLogDir ? t("data.opening_log_dir") : t("data.open_log_dir")}
      openingLogDir={controller.openingLogDir}
      onVacuum={() => void controller.handleVacuum()}
      onBackupDatabase={() => void controller.handleBackupDatabase()}
      onOpenLogDir={() => void controller.handleOpenLogDir()}
      onImportSettingsProfile={(file) => void controller.handleImportSettingsProfileFile(file)}
      onExportSettingsProfile={() => void controller.handleExportSettingsProfile()}
    />
  );
}
