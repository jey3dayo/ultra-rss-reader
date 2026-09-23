import {
  type BuildShortcutsSettingsViewPropsParams,
  buildShortcutCategoryOrder,
  buildShortcutsSettingsViewProps,
} from "../lib/shortcuts-settings-view-model";
import type { ShortcutsSettingsViewProps } from "../shortcuts-settings-view";

export function useShortcutsSettingsViewProps(
  params: BuildShortcutsSettingsViewPropsParams,
): ShortcutsSettingsViewProps {
  return buildShortcutsSettingsViewProps(params);
}

export { buildShortcutCategoryOrder };
