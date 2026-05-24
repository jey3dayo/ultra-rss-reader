import { Copy } from "lucide-react";
import type { ActionsSettingsViewProps } from "../actions-settings-view";
import { type ActionsSettingsServiceId, buildActionsSettingsViewModel } from "../lib/actions-settings-view-model";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference";

const ACTIONS_SETTINGS_SERVICE_ICONS: Record<ActionsSettingsServiceId, React.ReactNode> = {
  "action-copy-link": <Copy className="size-5" />,
};

export function useActionsSettingsViewProps(params: SettingsPreferenceViewPropsParams): ActionsSettingsViewProps {
  const viewModel = buildActionsSettingsViewModel(params);

  return {
    ...viewModel,
    services: viewModel.services.map((service) => ({
      ...service,
      icon: ACTIONS_SETTINGS_SERVICE_ICONS[service.id],
    })),
  };
}
