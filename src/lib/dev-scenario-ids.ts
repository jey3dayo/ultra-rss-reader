export const DEV_SCENARIO_ID = {
  openSubscriptionsIndex: "open-subscriptions-index",
  openWebPreviewUrl: "open-web-preview-url",
  openFeedFirstArticle: "open-feed-first-article",
  openTagView: "open-tag-view",
  openSettingsReading: "open-settings-reading",
  openSettingsAccountsAdd: "open-settings-accounts-add",
  openSettingsReadingDisplayMode: "open-settings-reading-display-mode",
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
  DEV_SCENARIO_ID.openSettingsReading,
  DEV_SCENARIO_ID.openSettingsAccountsAdd,
  DEV_SCENARIO_ID.openSettingsReadingDisplayMode,
  DEV_SCENARIO_ID.openAddFeedDialog,
  DEV_SCENARIO_ID.openFeedCleanup,
  DEV_SCENARIO_ID.openFeedCleanupBrokenReferences,
  DEV_SCENARIO_ID.syncAllSmoke,
] as const satisfies readonly DevScenarioId[];

const DEV_SCENARIO_ID_SET = new Set<string>(DEV_SCENARIO_IDS);

export function isDevScenarioId(value: string): value is DevScenarioId {
  return DEV_SCENARIO_ID_SET.has(value);
}
