import { useTranslation } from "react-i18next";
import { ReadingSettingsView } from "@/components/settings/reading-settings-view";
import { useResolvedDevIntent } from "@/hooks/use-resolved-dev-intent";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useReadingSettingsViewProps } from "./use-reading-settings-view-props";

export function ReadingSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const { intent: devIntent } = useResolvedDevIntent();
  const viewProps = useReadingSettingsViewProps({
    t,
    prefs,
    setPref,
    devIntent,
  });

  return <ReadingSettingsView {...viewProps} />;
}
