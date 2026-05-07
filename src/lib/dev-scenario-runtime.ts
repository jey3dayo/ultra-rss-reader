import { Result } from "@praha/byethrow";
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

export type DevScenarioRuntimeError =
  | { type: "unavailable"; message: string }
  | { type: "module_load_failed"; message: string }
  | { type: "invalid_module"; message: string }
  | { type: "scenario_failed"; message: string };

let devScenariosModulePromise: Promise<DevScenariosModule> | null = null;

const DEV_SCENARIOS_MODULE_PATH = "/src/dev/scenarios/index.ts";
const DEV_SCENARIOS_UNAVAILABLE_MESSAGE = "Dev scenarios runtime is unavailable outside dev builds.";

function getDevScenariosModuleUrl(): string {
  return DEV_SCENARIOS_MODULE_PATH;
}

class InvalidDevScenariosModuleError extends Error {
  constructor() {
    super("Dev scenarios module does not match the expected runtime interface.");
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function isDevScenariosModule(value: unknown): value is DevScenariosModule {
  return isRecord(value) && typeof value.listDevScenarios === "function" && typeof value.runDevScenario === "function";
}

async function importDevScenariosModule(): Promise<DevScenariosModule> {
  const module: unknown = await import(/* @vite-ignore */ getDevScenariosModuleUrl());
  if (!isDevScenariosModule(module)) {
    throw new InvalidDevScenariosModuleError();
  }
  return module;
}

function toDevScenarioModuleError(error: unknown): DevScenarioRuntimeError {
  if (error instanceof InvalidDevScenariosModuleError) {
    return { type: "invalid_module", message: error.message };
  }
  return { type: "module_load_failed", message: toErrorMessage(error) };
}

function toDevScenarioRuntimeException(error: DevScenarioRuntimeError): Error {
  return new Error(error.message);
}

function loadDevScenariosModuleResult(): Result.ResultAsync<DevScenariosModule, DevScenarioRuntimeError> {
  if (!import.meta.env.DEV) {
    return Promise.resolve(Result.fail({ type: "unavailable", message: DEV_SCENARIOS_UNAVAILABLE_MESSAGE }));
  }

  return Result.try({
    try: async () => {
      devScenariosModulePromise ??= importDevScenariosModule();
      return await devScenariosModulePromise;
    },
    catch: toDevScenarioModuleError,
  });
}

export async function loadRuntimeDevScenariosResult(): Result.ResultAsync<
  RuntimeDevScenario[],
  DevScenarioRuntimeError
> {
  const moduleResult = await loadDevScenariosModuleResult();
  if (Result.isFailure(moduleResult)) {
    return Result.fail(Result.unwrapError(moduleResult));
  }

  return Result.try({
    try: async () =>
      Result.unwrap(moduleResult)
        .listDevScenarios()
        .map(({ id, title, keywords }) => ({ id, title, keywords })),
    catch: toDevScenarioModuleError,
  });
}

export async function runRuntimeDevScenarioResult(
  id: DevScenarioId,
): Result.ResultAsync<void, DevScenarioRuntimeError> {
  const moduleResult = await loadDevScenariosModuleResult();
  if (Result.isFailure(moduleResult)) {
    return Result.fail(Result.unwrapError(moduleResult));
  }

  return Result.try({
    try: async () => {
      await Result.unwrap(moduleResult).runDevScenario(id);
    },
    catch: (error) => ({ type: "scenario_failed", message: toErrorMessage(error) }),
  });
}

export async function loadRuntimeDevScenarios(): Promise<RuntimeDevScenario[]> {
  const result = await loadRuntimeDevScenariosResult();
  if (Result.isFailure(result)) {
    throw toDevScenarioRuntimeException(Result.unwrapError(result));
  }
  return Result.unwrap(result);
}

export async function runRuntimeDevScenario(id: DevScenarioId): Promise<void> {
  const result = await runRuntimeDevScenarioResult(id);
  if (Result.isFailure(result)) {
    throw toDevScenarioRuntimeException(Result.unwrapError(result));
  }
}
