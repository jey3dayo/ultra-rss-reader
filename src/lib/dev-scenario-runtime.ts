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

const DEV_SCENARIOS_MODULE_PATH = "/src/dev/scenarios/index.ts";

function getDevScenariosModuleUrl(): string {
  return DEV_SCENARIOS_MODULE_PATH;
}

async function loadDevScenariosModule(): Promise<DevScenariosModule> {
  if (!import.meta.env.DEV) {
    throw new Error("Dev scenarios runtime is unavailable outside dev builds.");
  }

  devScenariosModulePromise ??= import(/* @vite-ignore */ getDevScenariosModuleUrl()) as Promise<DevScenariosModule>;
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
