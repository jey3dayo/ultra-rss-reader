import { useTranslation } from "react-i18next";
import { GeneralSettingsView } from "@/components/settings/general-settings-view";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useGeneralSettingsViewProps } from "./use-general-settings-view-props";

export function GeneralSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const platformKind = usePlatformStore((s) => s.platform.kind);
  const supportsBackgroundBrowserOpen = usePlatformStore(
    (s) => s.platform.capabilities.supports_background_browser_open,
  );
  const viewProps = useGeneralSettingsViewProps({
    t,
    prefs,
    setPref,
    platformKind,
    supportsBackgroundBrowserOpen,
  });

  return <GeneralSettingsView {...viewProps} />;
}
