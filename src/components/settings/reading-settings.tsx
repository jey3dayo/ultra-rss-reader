import { useTranslation } from "react-i18next";
import { ReadingSettingsView } from "@/components/settings/reading-settings-view";
import { useResolvedDevIntent } from "@/dev/use-resolved-dev-intent";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useReadingSettingsViewProps } from "./use-reading-settings-view-props";

export function ReadingSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const { intent: devIntent } = useResolvedDevIntent();
  const platformKind = usePlatformStore((s) => s.platform.kind);
  const supportsBackgroundBrowserOpen = usePlatformStore(
    (s) => s.platform.capabilities.supports_background_browser_open,
  );
  const viewProps = useReadingSettingsViewProps({
    t,
    prefs,
    setPref,
    devIntent,
    platformKind,
    supportsBackgroundBrowserOpen,
  });

  return <ReadingSettingsView {...viewProps} />;
}
