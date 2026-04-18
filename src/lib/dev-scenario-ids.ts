export const DEV_SCENARIO_ID = {
  openSubscriptionsIndex: "open-subscriptions-index",
  openWebPreviewUrl: "open-web-preview-url",
  openFeedFirstArticle: "open-feed-first-article",
  openTagView: "open-tag-view",
  openSettingsGeneral: "open-settings-general",
  openSettingsAppearance: "open-settings-appearance",
  openSettingsMute: "open-settings-mute",
  openSettingsReading: "open-settings-reading",
  openSettingsTags: "open-settings-tags",
  openSettingsShortcuts: "open-settings-shortcuts",
  openSettingsActions: "open-settings-actions",
  openSettingsData: "open-settings-data",
  openSettingsDebug: "open-settings-debug",
  openSettingsAccounts: "open-settings-accounts",
  openSettingsAccountsAdd: "open-settings-accounts-add",
  openSettingsReadingDisplayMode: "open-settings-reading-display-mode",
  openCommandPalette: "open-command-palette",
  openShortcutsHelp: "open-shortcuts-help",
  openWebPreviewGeometryCheck: "open-web-preview-geometry-check",
  openAddFeedDialog: "open-add-feed-dialog",
  openFeedCleanup: "open-feed-cleanup",
  openFeedCleanupBrokenReferences: "open-feed-cleanup-broken-references",
  syncAllSmoke: "sync-all-smoke",
} as const;

export type DevScenarioId = (typeof DEV_SCENARIO_ID)[keyof typeof DEV_SCENARIO_ID];

export const DEV_SCENARIO_IDS = [
  DEV_SCENARIO_ID.openSubscriptionsIndex,
  DEV_SCENARIO_ID.openWebPreviewUrl,
  DEV_SCENARIO_ID.openFeedFirstArticle,
  DEV_SCENARIO_ID.openTagView,
  DEV_SCENARIO_ID.openSettingsGeneral,
  DEV_SCENARIO_ID.openSettingsAppearance,
  DEV_SCENARIO_ID.openSettingsMute,
  DEV_SCENARIO_ID.openSettingsReading,
  DEV_SCENARIO_ID.openSettingsTags,
  DEV_SCENARIO_ID.openSettingsShortcuts,
  DEV_SCENARIO_ID.openSettingsActions,
  DEV_SCENARIO_ID.openSettingsData,
  DEV_SCENARIO_ID.openSettingsDebug,
  DEV_SCENARIO_ID.openSettingsAccounts,
  DEV_SCENARIO_ID.openSettingsAccountsAdd,
  DEV_SCENARIO_ID.openSettingsReadingDisplayMode,
  DEV_SCENARIO_ID.openCommandPalette,
  DEV_SCENARIO_ID.openShortcutsHelp,
  DEV_SCENARIO_ID.openWebPreviewGeometryCheck,
  DEV_SCENARIO_ID.openAddFeedDialog,
  DEV_SCENARIO_ID.openFeedCleanup,
  DEV_SCENARIO_ID.openFeedCleanupBrokenReferences,
  DEV_SCENARIO_ID.syncAllSmoke,
] as const satisfies readonly DevScenarioId[];

const DEV_SCENARIO_ID_SET = new Set<string>(DEV_SCENARIO_IDS);

export function isDevScenarioId(value: string): value is DevScenarioId {
  return DEV_SCENARIO_ID_SET.has(value);
}
