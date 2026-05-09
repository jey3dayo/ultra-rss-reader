import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import {
  DEV_SCENARIO_RUNTIME_IMPORTERS_FOR_TESTS,
  loadRuntimeDevScenarios,
  loadRuntimeDevScenariosResult,
  resetDevScenariosModuleCacheForTests,
  runRuntimeDevScenario,
  runRuntimeDevScenarioResult,
} from "@/dev/scenario-runtime";
import { DEV_SCENARIO_IDS } from "@/dev/scenarios/types";

const devScenariosModuleMock = vi.hoisted(() => ({
  module: {
    listDevScenarios: vi.fn(() => []),
    runDevScenario: vi.fn(async () => {}),
  } as {
    listDevScenarios?: unknown;
    runDevScenario?: unknown;
  },
}));

vi.mock("@/dev/scenarios", () => ({
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

  it("keeps the static import registry aligned with every dev scenario id", () => {
    expect(Object.keys(DEV_SCENARIO_RUNTIME_IMPORTERS_FOR_TESTS).sort()).toEqual([...DEV_SCENARIO_IDS].sort());
  });

  it("returns a typed failure outside dev builds", async () => {
    vi.stubEnv("DEV", false);

    const [loadResult, runResult] = await Promise.all([
      loadRuntimeDevScenariosResult(),
      runRuntimeDevScenarioResult(DEV_SCENARIO_ID.openSubscriptionsIndex),
    ]);

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

    const loadScenarios = loadRuntimeDevScenarios();
    const runScenario = runRuntimeDevScenario(DEV_SCENARIO_ID.openSubscriptionsIndex);

    await Promise.all([
      expect(loadScenarios).rejects.toThrow("Dev scenarios runtime is unavailable outside dev builds."),
      expect(runScenario).rejects.toThrow("Dev scenarios runtime is unavailable outside dev builds."),
    ]);
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

  it("retries module loading after a transient import failure", async () => {
    vi.stubEnv("DEV", true);
    const importScenarioModule = vi
      .spyOn(DEV_SCENARIO_RUNTIME_IMPORTERS_FOR_TESTS, DEV_SCENARIO_ID.openSubscriptionsIndex)
      .mockRejectedValueOnce(new Error("Temporary import failure"));

    const failedResult = await loadRuntimeDevScenariosResult();
    const retriedResult = await loadRuntimeDevScenariosResult();

    expect(Result.unwrapError(failedResult)).toEqual({
      type: "module_load_failed",
      message: "Temporary import failure",
    });
    expect(Result.unwrap(retriedResult)).toEqual([]);
    expect(importScenarioModule).toHaveBeenCalledTimes(2);
  });

  it("retries module loading after an invalid module", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {};

    const invalidResult = await loadRuntimeDevScenariosResult();
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => []),
      runDevScenario: vi.fn(async () => {}),
    };
    const retriedResult = await loadRuntimeDevScenariosResult();

    expect(Result.unwrapError(invalidResult)).toEqual({
      type: "invalid_module",
      message: "Dev scenarios module does not match the expected runtime interface.",
    });
    expect(Result.unwrap(retriedResult)).toEqual([]);
  });

  it("uses the runtime fallback message when module listing throws a non-error value", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => {
        throw undefined;
      }),
      runDevScenario: vi.fn(async () => {}),
    };

    const result = await loadRuntimeDevScenariosResult();

    expect(Result.unwrapError(result)).toEqual({
      type: "module_load_failed",
      message: "Unknown dev scenario runtime error.",
    });
  });

  it("returns scenario_failed when the scenario runner rejects", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => []),
      runDevScenario: vi.fn(async () => {
        throw new Error("Scenario action failed");
      }),
    };

    const result = await runRuntimeDevScenarioResult(DEV_SCENARIO_ID.openSubscriptionsIndex);

    expect(Result.unwrapError(result)).toEqual({
      type: "scenario_failed",
      message: "Scenario action failed",
    });
  });

  it("uses the runtime fallback message when the scenario runner rejects a non-error value", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => []),
      runDevScenario: vi.fn(async () => {
        throw undefined;
      }),
    };

    const result = await runRuntimeDevScenarioResult(DEV_SCENARIO_ID.openSubscriptionsIndex);

    expect(Result.unwrapError(result)).toEqual({
      type: "scenario_failed",
      message: "Unknown dev scenario runtime error.",
    });
  });
});
