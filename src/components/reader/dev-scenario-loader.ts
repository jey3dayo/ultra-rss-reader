import type { DevScenarioId } from "@/dev/scenarios/types";

export type CommandPaletteDevScenario = {
  id: DevScenarioId;
  title: string;
  keywords: readonly string[];
};

type DevScenariosModule = typeof import("@/dev/scenarios");

let devScenariosModulePromise: Promise<DevScenariosModule> | null = null;

function loadDevScenariosModule(): Promise<DevScenariosModule> {
  devScenariosModulePromise ??= import("@/dev/scenarios");
  return devScenariosModulePromise;
}

export async function loadCommandPaletteDevScenarios(): Promise<CommandPaletteDevScenario[]> {
  const module = await loadDevScenariosModule();
  return module.listDevScenarios().map(({ id, title, keywords }) => ({ id, title, keywords }));
}

export async function runCommandPaletteDevScenario(id: DevScenarioId): Promise<void> {
  const module = await loadDevScenariosModule();
  await module.runDevScenario(id);
}
