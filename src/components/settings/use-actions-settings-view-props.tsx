import { Copy } from "lucide-react";
import { resolvePreferenceValue } from "@/stores/preferences-store";
import type { ActionsSettingsViewProps } from "./actions-settings-view";
import type { SettingsPreferenceViewPropsParams } from "./settings-page.types";

export function useActionsSettingsViewProps({
  t,
  prefs,
  setPref,
}: SettingsPreferenceViewPropsParams): ActionsSettingsViewProps {
  const serviceEntries = [
    {
      id: "action-copy-link",
      label: t("actions.copy_link"),
      prefKey: "action_copy_link",
      icon: <Copy className="h-5 w-5" />,
    },
  ];

  return {
    title: t("actions.heading"),
    heading: t("actions.services"),
    toggleLabel: t("actions.show_in_toolbar"),
    services: serviceEntries.map((service) => ({
      id: service.id,
      label: service.label,
      icon: service.icon,
      checked: resolvePreferenceValue(prefs, service.prefKey) === "true",
      onCheckedChange: (checked) => setPref(service.prefKey, String(checked)),
    })),
  };
}
