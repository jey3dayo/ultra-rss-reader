import { Copy, ExternalLink, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionsSettingsView } from "@/components/settings/actions-settings-view";
import { usePreferencesStore } from "@/stores/preferences-store";

export function ActionsSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);

  const serviceEntries = [
    {
      id: "action-copy-link",
      label: t("actions.copy_link"),
      prefKey: "action_copy_link",
      icon: <Copy className="h-5 w-5" />,
    },
    {
      id: "action-open-browser",
      label: t("actions.open_in_browser"),
      prefKey: "action_open_browser",
      icon: <Globe className="h-5 w-5" />,
    },
    {
      id: "action-share",
      label: t("actions.open_in_external_browser"),
      prefKey: "action_share",
      icon: <ExternalLink className="h-5 w-5" />,
    },
  ];

  return (
    <ActionsSettingsView
      title={t("actions.heading")}
      heading={t("actions.services")}
      toggleLabel={t("actions.show_in_toolbar")}
      services={serviceEntries.map((service) => ({
        id: service.id,
        label: service.label,
        icon: service.icon,
        checked: prefs[service.prefKey] === "true",
        onCheckedChange: (checked) => setPref(service.prefKey, String(checked)),
      }))}
    />
  );
}
