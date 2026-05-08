import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import {
  loadRuntimeDevScenarios,
  loadRuntimeDevScenariosResult,
  resetDevScenariosModuleCacheForTests,
  runRuntimeDevScenario,
  runRuntimeDevScenarioResult,
} from "@/dev/scenario-runtime";

const devScenariosModuleMock = vi.hoisted(() => ({
  module: {
    listDevScenarios: vi.fn(() => []),
    runDevScenario: vi.fn(async () => {}),
  } as {
    listDevScenarios?: unknown;
    runDevScenario?: unknown;
  },
}));

vi.mock("/src/dev/scenarios/index.ts", () => ({
  get listDevScenarios() {
    return devScenariosModuleMock.module.listDevScenarios;
  },
  get runDevScenario() {
    return devScenariosModuleMock.module.runDevScenario;
  },
}));

describe("dev-scenario-runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetDevScenariosModuleCacheForTests();
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => []),
      runDevScenario: vi.fn(async () => {}),
    };
  });

  it("returns a typed failure outside dev builds", async () => {
    vi.stubEnv("DEV", false);

    const loadResult = await loadRuntimeDevScenariosResult();
    const runResult = await runRuntimeDevScenarioResult(DEV_SCENARIO_ID.openSubscriptionsIndex);

    expect(Result.unwrapError(loadResult)).toEqual({
      type: "unavailable",
      message: "Dev scenarios runtime is unavailable outside dev builds.",
    });
    expect(Result.unwrapError(runResult)).toEqual({
      type: "unavailable",
      message: "Dev scenarios runtime is unavailable outside dev builds.",
    });
  });

  it("keeps the promise wrapper rejection behavior outside dev builds", async () => {
    vi.stubEnv("DEV", false);

    await expect(loadRuntimeDevScenarios()).rejects.toThrow("Dev scenarios runtime is unavailable outside dev builds.");
    await expect(runRuntimeDevScenario(DEV_SCENARIO_ID.openSubscriptionsIndex)).rejects.toThrow(
      "Dev scenarios runtime is unavailable outside dev builds.",
    );
  });

  it("returns invalid_module when the dynamic import resolves to an invalid module", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => []),
    };

    const result = await loadRuntimeDevScenariosResult();

    expect(Result.unwrapError(result)).toEqual({
      type: "invalid_module",
      message: "Dev scenarios module does not match the expected runtime interface.",
    });
  });

  it("rejects promise wrappers with the invalid module message", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {};

    await expect(loadRuntimeDevScenarios()).rejects.toThrow(
      "Dev scenarios module does not match the expected runtime interface.",
    );
  });

  it("keeps invalid modules separate from module load failures after cache reset", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {};

    const invalidResult = await loadRuntimeDevScenariosResult();

    resetDevScenariosModuleCacheForTests();
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => {
        throw new Error("Registry failed");
      }),
      runDevScenario: vi.fn(async () => {}),
    };

    const loadFailureResult = await loadRuntimeDevScenariosResult();

    expect(Result.unwrapError(invalidResult).type).toBe("invalid_module");
    expect(Result.unwrapError(loadFailureResult)).toEqual({
      type: "module_load_failed",
      message: "Registry failed",
    });
  });
});
