import {
  runOpenFeedFirstArticleScenario,
  runOpenTagViewScenario,
  runOpenWebPreviewUrlScenario,
} from "@/dev/scenarios/helpers";
import type { DevScenarioContext } from "@/dev/scenarios/types";
import { DEV_SCENARIO_ID, DEV_SCENARIO_IDS, type DevScenario, type DevScenarioId } from "@/dev/scenarios/types";
import type { AppAction } from "@/lib/actions";

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
  [DEV_SCENARIO_ID.openSettingsReading]: {
    title: "Open settings reading",
    keywords: ["settings", "reading", "display", "mode"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("reading")),
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
