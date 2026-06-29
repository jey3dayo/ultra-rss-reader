export const DEV_SCENARIO_ID = {
  openWebPreviewUrl: "__prod_disabled_open_web_preview_url__",
  openSettingsReadingDisplayMode: "__prod_disabled_open_settings_reading_display_mode__",
} as const;

export type DevScenarioId = (typeof DEV_SCENARIO_ID)[keyof typeof DEV_SCENARIO_ID];

export const DEV_SCENARIO_IDS: DevScenarioId[] = [];

export function isDevScenarioId(_value: string): _value is DevScenarioId {
  return false;
}
