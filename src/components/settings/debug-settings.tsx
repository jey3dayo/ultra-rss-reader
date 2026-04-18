import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPageView } from "@/components/settings/settings-page-view";
import { DEV_SCENARIO_ID, type DevScenarioId } from "@/lib/dev-scenario-ids";
import { runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { resolveDevWebPreviewGeometryUrl } from "@/lib/dev-web-preview-geometry";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { useDebugSettingsViewProps } from "./use-debug-settings-view-props";

export function DebugSettings() {
  const { t } = useTranslation("settings");
  const devBuild = import.meta.env.DEV;
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const showToast = useUiStore((s) => s.showToast);
  const loadPlatformInfo = usePlatformStore((s) => s.loadPlatformInfo);
  const platformLoaded = usePlatformStore((s) => s.loaded);
  const usesDevFileCredentials = usePlatformStore((s) => s.platform.capabilities.uses_dev_file_credentials);

  useEffect(() => {
    loadPlatformInfo();
  }, [loadPlatformInfo]);

  const openWebPreviewUrl = useCallback(() => {
    const url = resolvePreferenceValue(usePreferencesStore.getState().prefs, "debug_web_preview_url").trim();
    if (!url) {
      showToast(t("debug.web_preview_url_required"));
      return;
    }

    closeSettings();
    openBrowser(url);
  }, [closeSettings, openBrowser, showToast, t]);

  const openWebPreviewGeometryCheck = useCallback(() => {
    closeSettings();
    openBrowser(resolveDevWebPreviewGeometryUrl());
  }, [closeSettings, openBrowser]);

  const runScenario = useCallback(
    async (id: DevScenarioId) => {
      if (id !== DEV_SCENARIO_ID.openSettingsReadingDisplayMode) {
        closeSettings();
      }

      try {
        await runRuntimeDevScenario(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        showToast(t("debug.scenario_failed", { message }));
      }
    },
    [closeSettings, showToast, t],
  );

  const credentialsBackendValue = !platformLoaded
    ? t("debug.credentials_backend_detecting")
    : usesDevFileCredentials
      ? t("debug.credentials_backend_dev")
      : t("debug.credentials_backend_native");

  const viewProps = useDebugSettingsViewProps({
    t,
    prefs,
    setPref,
    devBuild,
    credentialsBackendValue,
    openWebPreviewUrl,
    openWebPreviewGeometryCheck,
    runFeedCleanupBrokenReferencesScenario: () => void runScenario(DEV_SCENARIO_ID.openFeedCleanupBrokenReferences),
    runReadingDisplayModeScenario: () => void runScenario(DEV_SCENARIO_ID.openSettingsReadingDisplayMode),
  });

  return <SettingsPageView {...viewProps} />;
}
