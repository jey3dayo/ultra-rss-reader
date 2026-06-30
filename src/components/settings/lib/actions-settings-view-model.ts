import { ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT } from "@/components/reader/article-toolbar-actions";
import type { KnownPreferenceKey } from "@/schemas/preference-values";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference";

type ToolbarSettingsActionId = "copy-link";
export type ActionsSettingsServiceId = "action-copy-link";

type ActionsSettingsServiceEntry = {
  toolbarActionId: ToolbarSettingsActionId;
  id: ActionsSettingsServiceId;
  prefKey: KnownPreferenceKey;
  labelKey: "actions.copy_link";
};

type ActionsSettingsServiceViewModel = {
  id: ActionsSettingsServiceId;
  label: string;
  toggleAriaLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export type ActionsSettingsViewModel = {
  title: string;
  heading: string;
  toggleLabel: string;
  services: ActionsSettingsServiceViewModel[];
};

export const ACTIONS_SETTINGS_SERVICE_ENTRIES = [
  {
    toolbarActionId: "copy-link",
    id: "action-copy-link",
    prefKey: "action_copy_link",
    labelKey: "actions.copy_link",
  },
] satisfies ActionsSettingsServiceEntry[];

export const ACTIONS_SETTINGS_TOOLBAR_ACTION_IDS = ACTIONS_SETTINGS_SERVICE_ENTRIES.map(
  (service) => service.toolbarActionId,
);

export const TOOLBAR_ACTION_IDS_WITH_SETTINGS = ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT.reduce<string[]>(
  (actionIds, action) => {
    if (ACTIONS_SETTINGS_TOOLBAR_ACTION_IDS.includes(action.actionId as ToolbarSettingsActionId)) {
      actionIds.push(action.actionId);
    }

    return actionIds;
  },
  [],
);

export function buildActionsSettingsViewModel({
  t,
  prefs,
  setPref,
}: SettingsPreferenceViewPropsParams): ActionsSettingsViewModel {
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
        checked: resolvePreferenceValue(prefs, service.prefKey) === "true",
        onCheckedChange: (checked) => setPref(service.prefKey, String(checked)),
      };
    }),
  };
}
