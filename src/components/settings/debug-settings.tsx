import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPageView } from "@/components/settings/settings-page-view";
import { runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function DebugSettings() {
  const { t } = useTranslation("settings");
  const devBuild = import.meta.env.DEV;
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const showToast = useUiStore((s) => s.showToast);

  const openWebPreviewUrl = useCallback(() => {
    const url = resolvePreferenceValue(usePreferencesStore.getState().prefs, "debug_web_preview_url").trim();
    if (!url) {
      showToast(t("debug.web_preview_url_required"));
      return;
    }

    closeSettings();
    openBrowser(url);
  }, [closeSettings, openBrowser, showToast, t]);

  const runScenario = useCallback(
    async (id: "image-viewer-overlay" | "open-feed-cleanup-broken-references" | "open-settings-reading-display-mode") => {
      if (id !== "open-settings-reading-display-mode") {
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

  return (
    <SettingsPageView
      title={t("debug.heading")}
      sections={[
        {
          id: "debug-browser",
          heading: t("debug.browser"),
          note: t("debug.browser_note"),
          controls: [
            {
              id: "debug-browser-hud",
              type: "switch",
              label: t("debug.web_preview_hud"),
              checked: resolvePreferenceValue(prefs, "debug_browser_hud") === "true",
              onChange: (checked) => setPref("debug_browser_hud", String(checked)),
            },
            {
              id: "debug-web-preview-url",
              type: "text",
              name: "debug_web_preview_url",
              label: t("debug.web_preview_url"),
              value: resolvePreferenceValue(prefs, "debug_web_preview_url"),
              placeholder: t("debug.web_preview_url_placeholder"),
              onChange: (value) => setPref("debug_web_preview_url", value),
            },
            {
              id: "debug-open-web-preview-url",
              type: "action",
              label: t("debug.open_web_preview_url"),
              actionLabel: t("debug.open_now"),
              onAction: openWebPreviewUrl,
            },
          ],
        },
        {
          id: "debug-scenarios",
          heading: t("debug.scenarios"),
          note: t("debug.scenarios_note"),
          controls: [
            {
              id: "debug-image-viewer-overlay",
              type: "action",
              label: t("debug.image_viewer_overlay"),
              actionLabel: t("debug.open_now"),
              disabled: !devBuild,
              onAction: () => void runScenario("image-viewer-overlay"),
            },
            {
              id: "debug-feed-cleanup-broken-references",
              type: "action",
              label: t("debug.feed_cleanup_broken_references"),
              actionLabel: t("debug.open_now"),
              disabled: !devBuild,
              onAction: () => void runScenario("open-feed-cleanup-broken-references"),
            },
            {
              id: "debug-reading-display-mode",
              type: "action",
              label: t("debug.reading_display_mode"),
              actionLabel: t("debug.open_now"),
              disabled: !devBuild,
              onAction: () => void runScenario("open-settings-reading-display-mode"),
            },
          ],
        },
      ]}
    />
  );
}
