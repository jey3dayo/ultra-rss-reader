import { useTranslation } from "react-i18next";
import { GeneralSettingsView } from "@/components/settings/general-settings-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useGeneralSettingsViewProps } from "./use-general-settings-view-props";

export function GeneralSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const viewProps = useGeneralSettingsViewProps({
    t,
    prefs,
    setPref,
  });

  return <GeneralSettingsView {...viewProps} />;
}
