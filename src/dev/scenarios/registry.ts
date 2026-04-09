import {
  runImageViewerOverlayScenario,
  runOpenFeedFirstArticleScenario,
  runOpenTagViewScenario,
  runOpenWebPreviewUrlScenario,
} from "@/dev/scenarios/helpers";
import type { DevScenarioContext } from "@/dev/scenarios/types";
import { DEV_SCENARIO_IDS, type DevScenario, type DevScenarioId } from "@/dev/scenarios/types";
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
  "image-viewer-overlay": {
    title: "Image viewer overlay",
    keywords: ["image", "viewer", "overlay"],
    run: runImageViewerOverlayScenario,
  },
  "open-web-preview-url": {
    title: "Open web preview URL",
    keywords: ["web", "preview", "url", "browser"],
    run: runOpenWebPreviewUrlScenario,
  },
  "open-feed-first-article": {
    title: "Open feed first article",
    keywords: ["feed", "article", "open"],
    run: runOpenFeedFirstArticleScenario,
  },
  "open-tag-view": {
    title: "Open tag view",
    keywords: ["tag", "view"],
    run: runOpenTagViewScenario,
  },
  "open-settings-reading": {
    title: "Open settings reading",
    keywords: ["settings", "reading", "display", "mode"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("reading")),
  },
  "open-settings-reading-display-mode": {
    title: "Open settings reading display mode",
    keywords: ["settings", "reading", "display", "mode", "dropdown"],
    run: createUiBackedDevScenarioRunner((ui) => ui.openSettings("reading")),
  },
  "open-add-feed-dialog": {
    title: "Open add feed dialog",
    keywords: ["add", "feed", "dialog"],
    run: createActionBackedDevScenarioRunner("open-add-feed"),
  },
  "open-feed-cleanup": {
    title: "Open feed cleanup",
    keywords: ["feed", "cleanup", "management"],
    run: createActionBackedDevScenarioRunner("open-feed-cleanup"),
  },
  "open-feed-cleanup-broken-references": {
    title: "Open feed cleanup broken references",
    keywords: ["feed", "cleanup", "management", "broken", "references", "integrity"],
    run: createActionBackedDevScenarioRunner("open-feed-cleanup"),
  },
  "sync-all-smoke": {
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
