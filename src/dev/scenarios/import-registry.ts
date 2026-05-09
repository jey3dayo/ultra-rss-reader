import { DEV_SCENARIO_ID, type DevScenarioId } from "@/dev/scenario-ids";

const loadDevScenariosRegistryModule = () => import("@/dev/scenarios");

export const DEV_SCENARIO_MODULE_IMPORTERS = {
  [DEV_SCENARIO_ID.openSubscriptionsIndex]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openWebPreviewUrl]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openFeedFirstArticle]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openTagView]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsGeneral]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsAppearance]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsMute]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsReading]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsTags]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsShortcuts]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsActions]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsData]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsDebug]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsAccounts]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsAccountsAdd]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsAccountsAddFreshRss]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openSettingsReadingDisplayMode]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openCommandPalette]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openShortcutsHelp]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openWebPreviewGeometryCheck]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.openAddFeedDialog]: loadDevScenariosRegistryModule,
  [DEV_SCENARIO_ID.syncAllSmoke]: loadDevScenariosRegistryModule,
} as const satisfies Record<DevScenarioId, () => Promise<unknown>>;
