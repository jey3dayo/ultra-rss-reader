export const DEV_SCENARIO_IDS = [
  "open-web-preview-url",
  "open-feed-first-article",
  "open-tag-view",
  "open-settings-reading",
  "open-settings-reading-display-mode",
  "open-add-feed-dialog",
  "open-feed-cleanup",
  "open-feed-cleanup-broken-references",
  "sync-all-smoke",
] as const;

export type DevScenarioId = (typeof DEV_SCENARIO_IDS)[number];

const DEV_SCENARIO_ID_SET = new Set<string>(DEV_SCENARIO_IDS);

export function isDevScenarioId(value: string): value is DevScenarioId {
  return DEV_SCENARIO_ID_SET.has(value);
}
