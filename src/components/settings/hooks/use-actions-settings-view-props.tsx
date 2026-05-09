import { Copy } from "lucide-react";
import type { KnownPreferenceKey } from "@/schemas/preferences";
import { resolvePreferenceValue } from "@/schemas/preferences";
import type { ActionsSettingsViewProps } from "../actions-settings-view";
import type { SettingsPreferenceViewPropsParams } from "../settings-page.types";

type ActionsSettingsServiceEntry = {
  id: string;
  prefKey: KnownPreferenceKey;
  labelKey: "actions.copy_link";
  icon: React.ReactNode;
};

const actionsSettingsServiceEntries = [
  {
    id: "action-copy-link",
    prefKey: "action_copy_link",
    labelKey: "actions.copy_link",
    icon: <Copy className="size-5" />,
  },
] satisfies ActionsSettingsServiceEntry[];

export function useActionsSettingsViewProps({
  t,
  prefs,
  setPref,
}: SettingsPreferenceViewPropsParams): ActionsSettingsViewProps {
  return {
    title: t("actions.heading"),
    heading: t("actions.services"),
    toggleLabel: t("actions.show_in_toolbar"),
    services: actionsSettingsServiceEntries.map((service) => ({
      id: service.id,
      label: t(service.labelKey),
      icon: service.icon,
      checked: resolvePreferenceValue(prefs, service.prefKey) === "true",
      onCheckedChange: (checked) => setPref(service.prefKey, String(checked)),
    })),
  };
}
