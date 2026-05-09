import { Result } from "@praha/byethrow";
import { DEV_SCENARIO_ID, type DevScenarioId } from "@/dev/scenario-ids";
import { DEV_SCENARIO_MODULE_IMPORTERS } from "@/dev/scenarios/import-registry";

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

const DEV_SCENARIOS_UNAVAILABLE_MESSAGE =
  "Dev scenarios runtime is unavailable outside dev builds.";
const UNKNOWN_DEV_SCENARIO_RUNTIME_ERROR_MESSAGE =
  "Unknown dev scenario runtime error.";

class InvalidDevScenariosModuleError extends Error {
  constructor() {
    super(
      "Dev scenarios module does not match the expected runtime interface.",
    );
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return UNKNOWN_DEV_SCENARIO_RUNTIME_ERROR_MESSAGE;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function isDevScenariosModule(value: unknown): value is DevScenariosModule {
  return (
    isRecord(value) &&
    typeof value.listDevScenarios === "function" &&
    typeof value.runDevScenario === "function"
  );
}

async function importDevScenariosModule(): Promise<DevScenariosModule> {
  const module: unknown =
    await DEV_SCENARIO_MODULE_IMPORTERS[
      DEV_SCENARIO_ID.openSubscriptionsIndex
    ]();
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

function loadDevScenariosModuleResult(): Result.ResultAsync<
  DevScenariosModule,
  DevScenarioRuntimeError
> {
  if (!import.meta.env.DEV) {
    return Promise.resolve(
      Result.fail({
        type: "unavailable",
        message: DEV_SCENARIOS_UNAVAILABLE_MESSAGE,
      }),
    );
  }

  return Result.try({
    try: async () => {
      devScenariosModulePromise ??= importDevScenariosModule();
      try {
        return await devScenariosModulePromise;
      } catch (error) {
        devScenariosModulePromise = null;
        throw error;
      }
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
    catch: (error) => ({
      type: "scenario_failed",
      message: toErrorMessage(error),
    }),
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

export function resetDevScenariosModuleCacheForTests(): void {
  devScenariosModulePromise = null;
}
