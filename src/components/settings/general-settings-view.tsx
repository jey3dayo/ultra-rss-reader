import { SettingsPageView, type SettingsPageViewProps } from "@/components/settings/settings-page-view";

export type GeneralSettingsViewProps = SettingsPageViewProps;

export function GeneralSettingsView(props: GeneralSettingsViewProps) {
  return <SettingsPageView {...props} />;
}
