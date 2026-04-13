import { useTranslation } from "react-i18next";
import { DataSettingsView } from "@/components/settings/data-settings-view";
import { useUiStore } from "@/stores/ui-store";
import { useDataSettingsController } from "./use-data-settings-controller";

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
      databaseSizeValue={controller.databaseSizeValue}
      optimizationHeading={t("data.optimization")}
      vacuumDescription={t("data.vacuum_description")}
      vacuumLabel={controller.vacuuming ? t("data.vacuuming") : t("data.vacuum")}
      vacuuming={controller.vacuuming}
      logsHeading={t("data.logs")}
      openLogDirDescription={t("data.open_log_dir_description")}
      openLogDirLabel={t("data.open_log_dir")}
      onVacuum={() => void controller.handleVacuum()}
      onOpenLogDir={() => void controller.handleOpenLogDir()}
    />
  );
}
