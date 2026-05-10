import { useTranslation } from "react-i18next";
import { DataSettingsView } from "@/components/settings/data-settings-view";
import { STORAGE_CLEANUP_POLICY_CONNECTIONS } from "@/constants/storage";
import { StorageCleanupPolicyConnectionsSchema } from "@/schemas/storage";
import { useUiStore } from "@/stores/ui-store";
import { useDataSettingsController } from "./hooks/use-data-settings-controller";
import { useRegisterSettingsDirtyState } from "./hooks/use-settings-dirty-state-registry";

const storageCleanupPolicyConnections = StorageCleanupPolicyConnectionsSchema.parse(STORAGE_CLEANUP_POLICY_CONNECTIONS);
const OPML_DATA_ACTION_POLICY_CHECKLIST = [
  "OPML import/export can take time on large subscription lists; keep the settings window open until the success or error summary appears.",
  "OPML import/export is not cancelable after it starts. If the source file looks unusually large, make a backup first and wait for the command to finish.",
  "Duplicate feeds are skipped during OPML import, and the completion summary should be treated as partial success when fewer feeds are added than the file contains.",
] as const;

export function DataSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((s) => s.showToast);
  const setSettingsLoading = useUiStore((s) => s.setSettingsLoading);
  const controller = useDataSettingsController({
    t,
    showToast,
    setSettingsLoading,
  });
  const dataActionPending = controller.vacuuming || controller.openingLogDir;
  const safetyChecklist = t("data.safety_checklist", {
    returnObjects: true,
    settingsDataResetStorageKeys: storageCleanupPolicyConnections.settingsDataResetKeys,
    privateDataExportStorageKeys: storageCleanupPolicyConnections.privateDataExportKeys,
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
      databaseSizeLabel={t("data.database_size")}
      databaseSizeStatus={controller.databaseSizeStatus}
      databaseSizeValue={controller.databaseSizeValue}
      databaseSizeLoadingLabel={t("data.database_size_loading")}
      databaseSizeErrorLabel={t("data.database_size_error")}
      safetyHeading={t("data.safety")}
      safetyDescription={t("data.safety_description")}
      safetyChecklist={[...safetyChecklist, ...OPML_DATA_ACTION_POLICY_CHECKLIST]}
      recoveryCriteriaHeading={t("data.recovery_criteria")}
      recoveryCriteriaTargetUnknownLabel={t("data.recovery_criteria_target_unknown_disabled")}
      destructiveRecoveryCriteria={controller.destructiveRecoveryCriteria}
      optimizationHeading={t("data.optimization")}
      vacuumDescription={t("data.vacuum_description")}
      vacuumLabel={t("data.vacuum")}
      vacuumActionLabel={controller.vacuuming ? t("data.vacuuming") : t("data.vacuum")}
      vacuuming={controller.vacuuming}
      logsHeading={t("data.logs")}
      openLogDirDescription={t("data.open_log_dir_description")}
      openLogDirLabel={t("data.open_log_dir")}
      openLogDirActionLabel={controller.openingLogDir ? t("data.opening_log_dir") : t("data.open_log_dir")}
      openingLogDir={controller.openingLogDir}
      onVacuum={() => void controller.handleVacuum()}
      onOpenLogDir={() => void controller.handleOpenLogDir()}
    />
  );
}
