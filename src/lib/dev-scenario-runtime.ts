import type { DevScenarioId } from "@/lib/dev-scenario-ids";

export type RuntimeDevScenario = {
  id: DevScenarioId;
  title: string;
  keywords: readonly string[];
};

type DevScenariosModule = {
  listDevScenarios(): Array<{
    id: DevScenarioId;
    title: string;
    keywords: readonly string[];
  }>;
  runDevScenario(id: DevScenarioId): Promise<void>;
};

let devScenariosModulePromise: Promise<DevScenariosModule> | null = null;

async function loadDevScenariosModule(): Promise<DevScenariosModule> {
  devScenariosModulePromise ??= import("@/dev/scenarios");
  return devScenariosModulePromise;
}

export async function loadRuntimeDevScenarios(): Promise<RuntimeDevScenario[]> {
  const module = await loadDevScenariosModule();
  return module.listDevScenarios().map(({ id, title, keywords }) => ({ id, title, keywords }));
}

export async function runRuntimeDevScenario(id: DevScenarioId): Promise<void> {
  const module = await loadDevScenariosModule();
  await module.runDevScenario(id);
}
