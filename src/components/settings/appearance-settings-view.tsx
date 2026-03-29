import { SettingsPageView, type SettingsPageViewProps } from "@/components/settings/settings-page-view";

export type AppearanceSettingsViewProps = SettingsPageViewProps;

export function AppearanceSettingsView(props: AppearanceSettingsViewProps) {
  return <SettingsPageView {...props} />;
}
