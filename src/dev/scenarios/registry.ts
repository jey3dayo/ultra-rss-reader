import { isDevScenarioId } from "@/dev/scenario-ids";
import {
  runOpenFeedFirstArticleScenario,
  runOpenFeedFirstArticleWebPreviewScenario,
  runOpenTagViewScenario,
  runOpenWebPreviewUrlScenario,
} from "@/dev/scenarios/helpers";
import type { DevScenarioContext } from "@/dev/scenarios/types";
import { DEV_SCENARIO_ID, DEV_SCENARIO_IDS, type DevScenario, type DevScenarioId } from "@/dev/scenarios/types";
import { resolveDevWebPreviewGeometryUrl } from "@/dev/web-preview-geometry";
import type { AppAction } from "@/lib/app-actions";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";

export type DevScenarioRegistryIndex = {
  scenarios: DevScenario[];
  scenarioById: Map<DevScenarioId, DevScenario>;
  ids: Set<DevScenarioId>;
  duplicateIds: DevScenarioId[];
  duplicateTitles: string[];
  duplicateKeywordsByScenarioId: Array<{
    id: DevScenarioId;
    duplicates: string[];
  }>;
};

export type DevScenarioRegistryDiagnostics = {
  readonly scenarioCount: number;
  readonly registeredIds: readonly DevScenarioId[];
  readonly duplicateIds: readonly DevScenarioId[];
  readonly duplicateTitles: readonly string[];
  readonly duplicateKeywordsByScenarioId: readonly {
    readonly id: DevScenarioId;
    readonly duplicates: readonly string[];
  }[];
  readonly ok: boolean;
};

function createActionBackedDevScenarioRunner(actionId: AppAction): DevScenario["run"] {
  return async ({ actions }: DevScenarioContext) => {
    await Promise.resolve(actions.executeAction(actionId));
  };
}

function createUiBackedDevScenarioRunner(run: (ui: DevScenarioContext["ui"]) => void): DevScenario["run"] {
  return ({ ui }) => {
    run(ui);
  };
}

function createBrowserBackedDevScenarioRunner(resolveUrl: () => string): DevScenario["run"] {
  return ({ ui }) => {
    ui.openBrowser(resolveUrl());
  };
}

export const DEV_SCENARIO_ACTION_ROUTES = {
  [DEV_SCENARIO_ID.openSubscriptionsIndex]: "open-subscriptions-index",
  [DEV_SCENARIO_ID.openSettingsAccountsAdd]: "open-settings-accounts-add",
  [DEV_SCENARIO_ID.openSettingsAccountsAddFreshRss]: "open-settings-accounts-add-freshrss",
  [DEV_SCENARIO_ID.openCommandPalette]: "open-command-palette",
  [DEV_SCENARIO_ID.openAddFeedDialog]: "open-add-feed",
  [DEV_SCENARIO_ID.syncAllSmoke]: "sync-all",
} as const satisfies Partial<Record<DevScenarioId, AppAction>>;

export const DEV_SCENARIO_SETTINGS_ROUTES = {
  [DEV_SCENARIO_ID.openSettingsGeneral]: "general",
  [DEV_SCENARIO_ID.openSettingsAppearance]: "appearance",
  [DEV_SCENARIO_ID.openSettingsMute]: "mute",
  [DEV_SCENARIO_ID.openSettingsReading]: "reading",
  [DEV_SCENARIO_ID.openSettingsTags]: "tags",
  [DEV_SCENARIO_ID.openSettingsShortcuts]: "shortcuts",
  [DEV_SCENARIO_ID.openSettingsActions]: "actions",
  [DEV_SCENARIO_ID.openSettingsData]: "data",
  [DEV_SCENARIO_ID.openSettingsDebug]: "debug",
  [DEV_SCENARIO_ID.openSettingsAccounts]: "accounts",
  [DEV_SCENARIO_ID.openSettingsReadingDisplayMode]: "reading",
} as const satisfies Partial<Record<DevScenarioId, SettingsCategory>>;

const DEV_SCENARIO_DETAILS: Record<DevScenarioId, Omit<DevScenario, "id">> = {
  [DEV_SCENARIO_ID.openSubscriptionsIndex]: {
    title: "Open subscriptions index",
    keywords: ["subscriptions", "index", "workspace", "review"],
    run: createActionBackedDevScenarioRunner(DEV_SCENARIO_ACTION_ROUTES[DEV_SCENARIO_ID.openSubscriptionsIndex]),
  },
  [DEV_SCENARIO_ID.openWebPreviewUrl]: {
    title: "Open web preview URL",
    keywords: ["web", "preview", "url", "browser"],
    run: runOpenWebPreviewUrlScenario,
  },
  [DEV_SCENARIO_ID.openFeedFirstArticle]: {
    title: "Open feed first article",
    keywords: ["feed", "article", "open"],
    run: runOpenFeedFirstArticleScenario,
  },
  [DEV_SCENARIO_ID.openFeedFirstArticleWebPreview]: {
    title: "Open feed first article web preview",
    keywords: ["feed", "article", "web", "preview", "browser"],
    run: runOpenFeedFirstArticleWebPreviewScenario,
  },
  [DEV_SCENARIO_ID.openTagView]: {
    title: "Open tag view",
    keywords: ["tag", "view"],
    run: runOpenTagViewScenario,
  },
  [DEV_SCENARIO_ID.openSettingsGeneral]: {
    title: "Open settings general",
    keywords: ["settings", "general", "一般", "サイドバー", "ナビゲーション"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsGeneral]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsAppearance]: {
    title: "Open settings appearance",
    keywords: ["settings", "appearance", "外観", "テーマ", "サイドバー"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsAppearance]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsMute]: {
    title: "Open settings mute",
    keywords: ["settings", "mute"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsMute]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsReading]: {
    title: "Open settings reading",
    keywords: ["settings", "reading", "display", "mode", "閲覧", "記事一覧", "表示"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsReading]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsTags]: {
    title: "Open settings tags",
    keywords: ["settings", "tags"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsTags]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsShortcuts]: {
    title: "Open settings shortcuts",
    keywords: ["settings", "shortcuts"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsShortcuts]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsActions]: {
    title: "Open settings actions",
    keywords: ["settings", "actions"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsActions]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsData]: {
    title: "Open settings data",
    keywords: ["settings", "data", "データ", "データ管理"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsData]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsDebug]: {
    title: "Open settings debug",
    keywords: ["settings", "debug"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsDebug]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsAccounts]: {
    title: "Open settings accounts",
    keywords: ["settings", "accounts"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsAccounts]),
    ),
  },
  [DEV_SCENARIO_ID.openSettingsAccountsAdd]: {
    title: "Open settings accounts add",
    keywords: ["settings", "accounts", "add", "account"],
    run: createActionBackedDevScenarioRunner(DEV_SCENARIO_ACTION_ROUTES[DEV_SCENARIO_ID.openSettingsAccountsAdd]),
  },
  [DEV_SCENARIO_ID.openSettingsAccountsAddFreshRss]: {
    title: "Open settings accounts add FreshRSS",
    keywords: ["settings", "accounts", "add", "account", "freshrss", "credentials", "debug"],
    run: createActionBackedDevScenarioRunner(
      DEV_SCENARIO_ACTION_ROUTES[DEV_SCENARIO_ID.openSettingsAccountsAddFreshRss],
    ),
  },
  [DEV_SCENARIO_ID.openSettingsReadingDisplayMode]: {
    title: "Open settings reading display mode",
    keywords: ["settings", "reading", "display", "mode", "dropdown", "閲覧", "表示"],
    run: createUiBackedDevScenarioRunner((ui) =>
      ui.openSettings(DEV_SCENARIO_SETTINGS_ROUTES[DEV_SCENARIO_ID.openSettingsReadingDisplayMode]),
    ),
  },
  [DEV_SCENARIO_ID.openCommandPalette]: {
    title: "Open command palette",
    keywords: ["command", "palette", "search"],
    run: createActionBackedDevScenarioRunner(DEV_SCENARIO_ACTION_ROUTES[DEV_SCENARIO_ID.openCommandPalette]),
  },
  [DEV_SCENARIO_ID.openShortcutsHelp]: {
    title: "Open shortcuts help",
    keywords: ["shortcuts", "help", "keyboard"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openShortcutsHelp()),
  },
  [DEV_SCENARIO_ID.openWebPreviewGeometryCheck]: {
    title: "Open web preview geometry check",
    keywords: ["web", "preview", "geometry", "debug", "layout"],
    run: createBrowserBackedDevScenarioRunner(resolveDevWebPreviewGeometryUrl),
  },
  [DEV_SCENARIO_ID.openAddFeedDialog]: {
    title: "Open add feed dialog",
    keywords: ["add", "feed", "dialog"],
    run: createActionBackedDevScenarioRunner(DEV_SCENARIO_ACTION_ROUTES[DEV_SCENARIO_ID.openAddFeedDialog]),
  },
  [DEV_SCENARIO_ID.syncAllSmoke]: {
    title: "Sync all smoke",
    keywords: ["sync", "smoke"],
    run: createActionBackedDevScenarioRunner(DEV_SCENARIO_ACTION_ROUTES[DEV_SCENARIO_ID.syncAllSmoke]),
  },
};

const DEV_SCENARIOS: DevScenario[] = DEV_SCENARIO_IDS.map((id) => ({
  id,
  ...DEV_SCENARIO_DETAILS[id],
}));

function findDuplicateRegistryValues<TValue extends string>(values: Iterable<TValue>): TValue[] {
  const seen = new Set<TValue>();
  const duplicates = new Set<TValue>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return Array.from(duplicates).toSorted();
}

export function createDevScenarioRegistryIndex(scenarios: readonly DevScenario[]): DevScenarioRegistryIndex {
  const stableScenarios = [...scenarios];
  const duplicateKeywordsByScenarioId: DevScenarioRegistryIndex["duplicateKeywordsByScenarioId"] = [];
  for (const scenario of stableScenarios) {
    const duplicates = findDuplicateRegistryValues(scenario.keywords);
    if (duplicates.length > 0) {
      duplicateKeywordsByScenarioId.push({
        id: scenario.id,
        duplicates,
      });
    }
  }

  return {
    scenarios: stableScenarios,
    scenarioById: new Map(stableScenarios.map((scenario) => [scenario.id, scenario])),
    ids: new Set(stableScenarios.map((scenario) => scenario.id)),
    duplicateIds: findDuplicateRegistryValues(stableScenarios.map((scenario) => scenario.id)),
    duplicateTitles: findDuplicateRegistryValues(stableScenarios.map((scenario) => scenario.title)),
    duplicateKeywordsByScenarioId,
  };
}

const DEV_SCENARIO_REGISTRY_INDEX = createDevScenarioRegistryIndex(DEV_SCENARIOS);

export function createDevScenarioRegistryDiagnostics(
  registryIndex: DevScenarioRegistryIndex,
): DevScenarioRegistryDiagnostics {
  return {
    scenarioCount: registryIndex.scenarios.length,
    registeredIds: [...registryIndex.ids],
    duplicateIds: [...registryIndex.duplicateIds],
    duplicateTitles: [...registryIndex.duplicateTitles],
    duplicateKeywordsByScenarioId: registryIndex.duplicateKeywordsByScenarioId.map(({ id, duplicates }) => ({
      id,
      duplicates: [...duplicates],
    })),
    ok:
      registryIndex.duplicateIds.length === 0 &&
      registryIndex.duplicateTitles.length === 0 &&
      registryIndex.duplicateKeywordsByScenarioId.length === 0,
  };
}

export function getDevScenarioRegistryDiagnostics(): DevScenarioRegistryDiagnostics {
  return createDevScenarioRegistryDiagnostics(DEV_SCENARIO_REGISTRY_INDEX);
}

export function formatDevScenarioRegistryDiagnosticsReport(diagnostics: DevScenarioRegistryDiagnostics): string {
  const lines = [
    "Dev scenario registry diagnostics",
    `status: ${diagnostics.ok ? "ok" : "failed"}`,
    `scenarioCount: ${diagnostics.scenarioCount}`,
    `registeredIds: ${diagnostics.registeredIds.join(", ")}`,
    `duplicateIds: ${diagnostics.duplicateIds.length === 0 ? "none" : diagnostics.duplicateIds.join(", ")}`,
    `duplicateTitles: ${diagnostics.duplicateTitles.length === 0 ? "none" : diagnostics.duplicateTitles.join(", ")}`,
  ];

  if (diagnostics.duplicateKeywordsByScenarioId.length === 0) {
    lines.push("duplicateKeywords: none");
  } else {
    lines.push(
      `duplicateKeywords: ${diagnostics.duplicateKeywordsByScenarioId
        .map(({ id, duplicates }) => `${id}=[${duplicates.join(", ")}]`)
        .join("; ")}`,
    );
  }

  return lines.join("\n");
}

export function listDevScenarios(): DevScenario[] {
  return [...DEV_SCENARIO_REGISTRY_INDEX.scenarios];
}

export function getDevScenario(id: string): DevScenario | null {
  return isDevScenarioId(id) ? (DEV_SCENARIO_REGISTRY_INDEX.scenarioById.get(id) ?? null) : null;
}
