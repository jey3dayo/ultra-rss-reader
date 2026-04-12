import type { SettingsPageViewProps } from "@/components/settings/settings-page.types";
import { SettingsPageView } from "@/components/settings/settings-page-view";

export type ReadingSettingsViewProps = SettingsPageViewProps;

export function ReadingSettingsView(props: ReadingSettingsViewProps) {
  return <SettingsPageView {...props} />;
}
