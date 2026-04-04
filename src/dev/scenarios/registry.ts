import type { DevScenario, DevScenarioId } from "@/dev/scenarios/types";

const DEV_SCENARIOS: DevScenario[] = [
  {
    id: "image-viewer-overlay",
    title: "Image viewer overlay",
    keywords: ["image", "viewer", "overlay"],
    run: () => undefined,
  },
  {
    id: "open-feed-first-article",
    title: "Open feed first article",
    keywords: ["feed", "article", "open"],
    run: () => undefined,
  },
  {
    id: "open-tag-view",
    title: "Open tag view",
    keywords: ["tag", "view"],
    run: () => undefined,
  },
  {
    id: "open-add-feed-dialog",
    title: "Open add feed dialog",
    keywords: ["add", "feed", "dialog"],
    run: () => undefined,
  },
  {
    id: "sync-all-smoke",
    title: "Sync all smoke",
    keywords: ["sync", "smoke"],
    run: () => undefined,
  },
] as const;

const DEV_SCENARIO_MAP = new Map<DevScenarioId, DevScenario>(DEV_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function listDevScenarios(): DevScenario[] {
  return [...DEV_SCENARIOS];
}

export function getDevScenario(id: string): DevScenario | null {
  return DEV_SCENARIO_MAP.get(id as DevScenarioId) ?? null;
}
