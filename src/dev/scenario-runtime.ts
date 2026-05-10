import { Result } from "@praha/byethrow";
import { DEV_SCENARIO_ID, type DevScenarioId, isDevScenarioId } from "@/dev/scenario-ids";
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

const DEV_SCENARIOS_UNAVAILABLE_MESSAGE = "Dev scenarios runtime is unavailable outside dev builds.";
const UNKNOWN_DEV_SCENARIO_RUNTIME_ERROR_MESSAGE = "Unknown dev scenario runtime error.";

class InvalidDevScenariosModuleError extends Error {
  constructor(message = "Dev scenarios module does not match the expected runtime interface.") {
    super(message);
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
  return isRecord(value) && typeof value.listDevScenarios === "function" && typeof value.runDevScenario === "function";
}

function validateRuntimeDevScenario(value: unknown): RuntimeDevScenario {
  if (!isRecord(value)) {
    throw new InvalidDevScenariosModuleError("Dev scenario metadata must be an object.");
  }

  const { id, title, keywords } = value;
  if (typeof id !== "string" || !isDevScenarioId(id)) {
    throw new InvalidDevScenariosModuleError("Dev scenario metadata contains an unknown id.");
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new InvalidDevScenariosModuleError("Dev scenario metadata contains a blank title.");
  }
  if (!Array.isArray(keywords) || keywords.some((keyword) => typeof keyword !== "string")) {
    throw new InvalidDevScenariosModuleError("Dev scenario metadata keywords must be a string array.");
  }

  return { id, title, keywords };
}

function validateRuntimeDevScenarios(value: unknown): RuntimeDevScenario[] {
  if (!Array.isArray(value)) {
    throw new InvalidDevScenariosModuleError("Dev scenarios metadata must be an array.");
  }

  return value.map(validateRuntimeDevScenario);
}

async function importDevScenariosModule(): Promise<DevScenariosModule> {
  const module: unknown = await DEV_SCENARIO_MODULE_IMPORTERS[DEV_SCENARIO_ID.openSubscriptionsIndex]();
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

function unwrapDevScenarioRuntimeResult<T>(
  result: Result.Result<T, DevScenarioRuntimeError>,
  toException: (error: DevScenarioRuntimeError) => Error,
): T {
  if (Result.isFailure(result)) {
    throw toException(result.error);
  }

  return result.value;
}

function loadDevScenariosModuleResult(): Result.ResultAsync<DevScenariosModule, DevScenarioRuntimeError> {
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
    return Result.fail(moduleResult.error);
  }
  const module = moduleResult.value;

  return Result.try({
    try: async () => validateRuntimeDevScenarios(module.listDevScenarios()),
    catch: toDevScenarioModuleError,
  });
}

export async function runRuntimeDevScenarioResult(
  id: DevScenarioId,
): Result.ResultAsync<void, DevScenarioRuntimeError> {
  const moduleResult = await loadDevScenariosModuleResult();
  if (Result.isFailure(moduleResult)) {
    return Result.fail(moduleResult.error);
  }
  const module = moduleResult.value;

  return Result.try({
    try: async () => {
      await module.runDevScenario(id);
    },
    catch: (error) => ({
      type: "scenario_failed",
      message: toErrorMessage(error),
    }),
  });
}

export async function loadRuntimeDevScenarios(): Promise<RuntimeDevScenario[]> {
  const result = await loadRuntimeDevScenariosResult();
  return unwrapDevScenarioRuntimeResult(result, toDevScenarioRuntimeException);
}

export async function runRuntimeDevScenario(id: DevScenarioId): Promise<void> {
  const result = await runRuntimeDevScenarioResult(id);
  unwrapDevScenarioRuntimeResult(result, toDevScenarioRuntimeException);
}

export function resetDevScenariosModuleCacheForTests(): void {
  devScenariosModulePromise = null;
}
