export type {
  SettingsDirtyStateActions,
  SettingsDirtyStateEntry,
  SettingsDirtyStateRegistry,
  SettingsDirtyStateSnapshot,
} from "@/lib/settings/settings-dirty-state-registry";
export {
  createSettingsDirtyStateRegistry,
  createSettingsDirtyStateSnapshot,
  discardDirtySettingsEntries,
  EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT,
  getSettingsDirtyStateSnapshot,
  saveDirtySettingsEntries,
} from "@/lib/settings/settings-dirty-state-registry";
