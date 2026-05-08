import { useTranslation } from "react-i18next";
import { DataSettingsView } from "@/components/settings/data-settings-view";
import { useUiStore } from "@/stores/ui-store";
import { useDataSettingsController } from "./hooks/use-data-settings-controller";

export function DataSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((s) => s.showToast);
  const setSettingsLoading = useUiStore((s) => s.setSettingsLoading);
  const controller = useDataSettingsController({
    t,
    showToast,
    setSettingsLoading,
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
      safetyChecklist={t("data.safety_checklist", { returnObjects: true })}
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
