import {
  runOpenFeedFirstArticleScenario,
  runOpenTagViewScenario,
  runOpenWebPreviewUrlScenario,
} from "@/dev/scenarios/helpers";
import type { DevScenarioContext } from "@/dev/scenarios/types";
import { DEV_SCENARIO_ID, DEV_SCENARIO_IDS, type DevScenario, type DevScenarioId } from "@/dev/scenarios/types";
import type { AppAction } from "@/lib/actions";
import { resolveDevWebPreviewGeometryUrl } from "@/lib/dev-web-preview-geometry";

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

const DEV_SCENARIO_DETAILS: Record<DevScenarioId, Omit<DevScenario, "id">> = {
  [DEV_SCENARIO_ID.openSubscriptionsIndex]: {
    title: "Open subscriptions index",
    keywords: ["subscriptions", "index", "workspace", "review"],
    run: createActionBackedDevScenarioRunner("open-subscriptions-index"),
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
  [DEV_SCENARIO_ID.openTagView]: {
    title: "Open tag view",
    keywords: ["tag", "view"],
    run: runOpenTagViewScenario,
  },
  [DEV_SCENARIO_ID.openSettingsGeneral]: {
    title: "Open settings general",
    keywords: ["settings", "general"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("general")),
  },
  [DEV_SCENARIO_ID.openSettingsAppearance]: {
    title: "Open settings appearance",
    keywords: ["settings", "appearance"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("appearance")),
  },
  [DEV_SCENARIO_ID.openSettingsMute]: {
    title: "Open settings mute",
    keywords: ["settings", "mute"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("mute")),
  },
  [DEV_SCENARIO_ID.openSettingsReading]: {
    title: "Open settings reading",
    keywords: ["settings", "reading", "display", "mode"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("reading")),
  },
  [DEV_SCENARIO_ID.openSettingsTags]: {
    title: "Open settings tags",
    keywords: ["settings", "tags"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("tags")),
  },
  [DEV_SCENARIO_ID.openSettingsShortcuts]: {
    title: "Open settings shortcuts",
    keywords: ["settings", "shortcuts"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("shortcuts")),
  },
  [DEV_SCENARIO_ID.openSettingsActions]: {
    title: "Open settings actions",
    keywords: ["settings", "actions"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("actions")),
  },
  [DEV_SCENARIO_ID.openSettingsData]: {
    title: "Open settings data",
    keywords: ["settings", "data"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("data")),
  },
  [DEV_SCENARIO_ID.openSettingsDebug]: {
    title: "Open settings debug",
    keywords: ["settings", "debug"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("debug")),
  },
  [DEV_SCENARIO_ID.openSettingsAccounts]: {
    title: "Open settings accounts",
    keywords: ["settings", "accounts"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("accounts")),
  },
  [DEV_SCENARIO_ID.openSettingsAccountsAdd]: {
    title: "Open settings accounts add",
    keywords: ["settings", "accounts", "add", "account"],
    run: createActionBackedDevScenarioRunner("open-settings-accounts-add"),
  },
  [DEV_SCENARIO_ID.openSettingsReadingDisplayMode]: {
    title: "Open settings reading display mode",
    keywords: ["settings", "reading", "display", "mode", "dropdown"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("reading")),
  },
  [DEV_SCENARIO_ID.openCommandPalette]: {
    title: "Open command palette",
    keywords: ["command", "palette", "search"],
    run: createActionBackedDevScenarioRunner("open-command-palette"),
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
    run: createActionBackedDevScenarioRunner("open-add-feed"),
  },
  [DEV_SCENARIO_ID.openFeedCleanup]: {
    title: "Open feed cleanup",
    keywords: ["feed", "cleanup", "management"],
    run: createActionBackedDevScenarioRunner("open-feed-cleanup"),
  },
  [DEV_SCENARIO_ID.openFeedCleanupBrokenReferences]: {
    title: "Open feed cleanup broken references",
    keywords: ["feed", "cleanup", "management", "broken", "references", "integrity"],
    run: createActionBackedDevScenarioRunner("open-feed-cleanup"),
  },
  [DEV_SCENARIO_ID.syncAllSmoke]: {
    title: "Sync all smoke",
    keywords: ["sync", "smoke"],
    run: createActionBackedDevScenarioRunner("sync-all"),
  },
};

const DEV_SCENARIOS: DevScenario[] = DEV_SCENARIO_IDS.map((id) => ({
  id,
  ...DEV_SCENARIO_DETAILS[id],
}));

const DEV_SCENARIO_MAP = new Map<DevScenarioId, DevScenario>(DEV_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function listDevScenarios(): DevScenario[] {
  return [...DEV_SCENARIOS];
}

export function getDevScenario(id: string): DevScenario | null {
  return DEV_SCENARIO_MAP.get(id as DevScenarioId) ?? null;
}
