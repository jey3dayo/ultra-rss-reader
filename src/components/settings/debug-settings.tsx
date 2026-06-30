import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPageView } from "@/components/settings/settings-page-view";
import { DEV_SCENARIO_ID, type DevScenarioId } from "@/dev/scenario-ids";
import { runRuntimeDevScenario } from "@/dev/scenario-runtime";
import { resolveDevWebPreviewGeometryUrl } from "@/dev/web-preview-geometry";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { resetDevCredentialsStore } from "./debug-settings-actions";
import { useDebugSettingsViewProps } from "./hooks/use-debug-settings-view-props";

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
  const platformLoadError = usePlatformStore((s) => s.loadError);
  const usesDevFileCredentials = usePlatformStore((s) => s.platform.capabilities.uses_dev_file_credentials);
  const [resettingDevCredentials, setResettingDevCredentials] = useState(false);

  useEffect(() => {
    loadPlatformInfo();
  }, [loadPlatformInfo]);

  const openWebPreviewUrl = useCallback(
    (requestedUrl: string) => {
      const url = requestedUrl.trim();
      if (!url) {
        showToast(t("debug.web_preview_url_required"));
        return;
      }
      try {
        new URL(url);
      } catch {
        showToast(t("debug.web_preview_url_invalid"));
        return;
      }

      closeSettings();
      window.setTimeout(() => {
        openBrowser(url);
      }, 0);
    },
    [closeSettings, openBrowser, showToast, t],
  );

  const openWebPreviewGeometryCheck = useCallback(() => {
    closeSettings();
    openBrowser(resolveDevWebPreviewGeometryUrl());
  }, [closeSettings, openBrowser]);

  const openWebPreviewToastCheck = useCallback(() => {
    closeSettings();
    openBrowser(resolveDevWebPreviewGeometryUrl());
    showToast(t("debug.web_preview_toast_check_toast"));
  }, [closeSettings, openBrowser, showToast, t]);

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

  const resetDevCredentials = useCallback(async () => {
    if (!usesDevFileCredentials || resettingDevCredentials) {
      return;
    }
    setResettingDevCredentials(true);
    try {
      const moved = await resetDevCredentialsStore();
      showToast(t(moved ? "debug.credentials_reset_success" : "debug.credentials_reset_noop"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(t("debug.credentials_reset_failed", { message }));
    } finally {
      setResettingDevCredentials(false);
    }
  }, [resettingDevCredentials, showToast, t, usesDevFileCredentials]);

  const credentialsBackendValue = platformLoadError
    ? t("debug.credentials_backend_load_failed")
    : !platformLoaded
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
    canResetDevCredentials: platformLoaded && usesDevFileCredentials,
    resetDevCredentials,
    resettingDevCredentials,
    openWebPreviewUrl,
    openWebPreviewGeometryCheck,
    openWebPreviewToastCheck,
    runReadingDisplayModeScenario: () => void runScenario(DEV_SCENARIO_ID.openSettingsReadingDisplayMode),
  });

  return <SettingsPageView {...viewProps} />;
}
