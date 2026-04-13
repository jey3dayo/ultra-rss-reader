import { useTranslation } from "react-i18next";
import { ActionsSettingsView } from "@/components/settings/actions-settings-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useActionsSettingsViewProps } from "./use-actions-settings-view-props";

export function ActionsSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const viewProps = useActionsSettingsViewProps({
    t,
    prefs,
    setPref,
  });

  return <ActionsSettingsView {...viewProps} />;
}
