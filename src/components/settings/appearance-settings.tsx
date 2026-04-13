import { useTranslation } from "react-i18next";
import { AppearanceSettingsView } from "@/components/settings/appearance-settings-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useAppearanceSettingsViewProps } from "./use-appearance-settings-view-props";

export function AppearanceSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const viewProps = useAppearanceSettingsViewProps({
    t,
    prefs,
    setPref,
  });

  return <AppearanceSettingsView {...viewProps} />;
}
