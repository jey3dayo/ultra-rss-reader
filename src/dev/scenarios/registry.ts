import { DEV_SCENARIO_IDS, type DevScenario, type DevScenarioId } from "@/dev/scenarios/types";

const DEV_SCENARIO_DETAILS: Record<DevScenarioId, Omit<DevScenario, "id">> = {
  "image-viewer-overlay": {
    title: "Image viewer overlay",
    keywords: ["image", "viewer", "overlay"],
    run: () => undefined,
  },
  "open-feed-first-article": {
    title: "Open feed first article",
    keywords: ["feed", "article", "open"],
    run: () => undefined,
  },
  "open-tag-view": {
    title: "Open tag view",
    keywords: ["tag", "view"],
    run: () => undefined,
  },
  "open-add-feed-dialog": {
    title: "Open add feed dialog",
    keywords: ["add", "feed", "dialog"],
    run: () => undefined,
  },
  "sync-all-smoke": {
    title: "Sync all smoke",
    keywords: ["sync", "smoke"],
    run: () => undefined,
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
