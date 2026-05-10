import { Copy } from "lucide-react";
import { ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT } from "@/components/reader/article-toolbar-view";
import type { KnownPreferenceKey } from "@/schemas/preferences";
import { resolvePreferenceValue } from "@/schemas/preferences";
import type { ActionsSettingsViewProps } from "../actions-settings-view";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference.types";

type ToolbarSettingsActionId = "copy-link";

type ActionsSettingsServiceEntry = {
  toolbarActionId: ToolbarSettingsActionId;
  id: string;
  prefKey: KnownPreferenceKey;
  labelKey: "actions.copy_link";
  icon: React.ReactNode;
};

export const ACTIONS_SETTINGS_SERVICE_ENTRIES = [
  {
    toolbarActionId: "copy-link",
    id: "action-copy-link",
    prefKey: "action_copy_link",
    labelKey: "actions.copy_link",
    icon: <Copy className="size-5" />,
  },
] satisfies ActionsSettingsServiceEntry[];

export const ACTIONS_SETTINGS_TOOLBAR_ACTION_IDS = ACTIONS_SETTINGS_SERVICE_ENTRIES.map(
  (service) => service.toolbarActionId,
);

export const TOOLBAR_ACTION_IDS_WITH_SETTINGS = ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT.filter((action) =>
  ACTIONS_SETTINGS_TOOLBAR_ACTION_IDS.includes(action.actionId as ToolbarSettingsActionId),
).map((action) => action.actionId);

export function useActionsSettingsViewProps({
  t,
  prefs,
  setPref,
}: SettingsPreferenceViewPropsParams): ActionsSettingsViewProps {
  return {
    title: t("actions.heading"),
    heading: t("actions.services"),
    toggleLabel: t("actions.show_in_toolbar"),
    services: ACTIONS_SETTINGS_SERVICE_ENTRIES.map((service) => {
      const label = t(service.labelKey);

      return {
        id: service.id,
        label,
        toggleAriaLabel: `${t("actions.show_in_toolbar")}: ${label}`,
        icon: service.icon,
        checked: resolvePreferenceValue(prefs, service.prefKey) === "true",
        onCheckedChange: (checked) => setPref(service.prefKey, String(checked)),
      };
    }),
  };
}
