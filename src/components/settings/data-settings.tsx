import { useTranslation } from "react-i18next";
import { DataSettingsView } from "@/components/settings/data-settings-view";
import { STORAGE_CLEANUP_POLICY_CONNECTIONS } from "@/constants/storage";
import { StorageCleanupPolicyConnectionsSchema } from "@/schemas/storage";
import { useUiStore } from "@/stores/ui-store";
import { useDataSettingsController } from "./hooks/use-data-settings-controller";
import { useRegisterSettingsDirtyState } from "./hooks/use-settings-dirty-state-registry";

const storageCleanupPolicyConnections = StorageCleanupPolicyConnectionsSchema.parse(STORAGE_CLEANUP_POLICY_CONNECTIONS);

export function DataSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((s) => s.showToast);
  const controller = useDataSettingsController({
    t,
    showToast,
  });
  const dataActionPending = controller.vacuuming || controller.openingLogDir;

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
      safetyChecklist={t("data.safety_checklist", {
        returnObjects: true,
        settingsDataResetStorageKeys: storageCleanupPolicyConnections.settingsDataResetKeys,
        privateDataExportStorageKeys: storageCleanupPolicyConnections.privateDataExportKeys,
      })}
      recoveryCriteriaHeading={t("data.recovery_criteria")}
      recoveryCriteriaTargetUnknownLabel={t("data.recovery_criteria_target_unknown_disabled")}
      destructiveRecoveryCriteria={controller.destructiveRecoveryCriteria}
      optimizationHeading={t("data.optimization")}
      vacuumDescription={t("data.vacuum_description")}
      vacuumLabel={controller.vacuuming ? t("data.vacuuming") : t("data.vacuum")}
      vacuuming={controller.vacuuming}
      logsHeading={t("data.logs")}
      openLogDirDescription={t("data.open_log_dir_description")}
      openLogDirLabel={controller.openingLogDir ? t("data.opening_log_dir") : t("data.open_log_dir")}
      openingLogDir={controller.openingLogDir}
      onVacuum={() => void controller.handleVacuum()}
      onOpenLogDir={() => void controller.handleOpenLogDir()}
    />
  );
}
