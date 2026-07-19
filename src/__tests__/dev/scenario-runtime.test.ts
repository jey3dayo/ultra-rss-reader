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
import { DEV_SCENARIO_MODULE_IMPORTERS } from "@/dev/scenarios/import-registry";
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

function expectResultValue<T, E>(result: Result.Result<T, E>): T {
  if (Result.isFailure(result)) {
    throw new Error(`Expected success result, received failure: ${JSON.stringify(result.error)}`);
  }

  return result.value;
}

function expectResultError<T, E>(result: Result.Result<T, E>): E {
  if (!Result.isFailure(result)) {
    throw new Error(`Expected failure result, received success: ${JSON.stringify(result.value)}`);
  }

  return result.error;
}

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
    expect(Object.keys(DEV_SCENARIO_MODULE_IMPORTERS).toSorted()).toEqual([...DEV_SCENARIO_IDS].toSorted());
  });

  it("returns a typed failure outside dev builds", async () => {
    vi.stubEnv("DEV", false);

    const [loadResult, runResult] = await Promise.all([
      loadRuntimeDevScenariosResult(),
      runRuntimeDevScenarioResult(DEV_SCENARIO_ID.openSubscriptionsIndex),
    ]);

    expect(expectResultError(loadResult)).toEqual({
      type: "unavailable",
      message: "Dev scenarios runtime is unavailable outside dev builds.",
    });
    expect(expectResultError(runResult)).toEqual({
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

    expect(expectResultError(result)).toEqual({
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

    // Cache reset is the contract under test here, so these load attempts must remain sequential.
    const invalidResult = await loadRuntimeDevScenariosResult();

    resetDevScenariosModuleCacheForTests();
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => {
        throw new Error("Registry failed");
      }),
      runDevScenario: vi.fn(async () => {}),
    };

    const loadFailureResult = await loadRuntimeDevScenariosResult();

    expect(expectResultError(invalidResult).type).toBe("invalid_module");
    expect(expectResultError(loadFailureResult)).toEqual({
      type: "module_load_failed",
      message: "Registry failed",
    });
  });

  it("retries module loading after a transient import failure", async () => {
    vi.stubEnv("DEV", true);
    const importScenarioModule = vi
      .spyOn(DEV_SCENARIO_MODULE_IMPORTERS, DEV_SCENARIO_ID.openSubscriptionsIndex)
      .mockRejectedValueOnce(new Error("Temporary import failure"));

    // Retry behavior depends on the first rejected import being observed before the second load.
    const failedResult = await loadRuntimeDevScenariosResult();
    const retriedResult = await loadRuntimeDevScenariosResult();

    expect(expectResultError(failedResult)).toEqual({
      type: "module_load_failed",
      message: "Temporary import failure",
    });
    expect(expectResultValue(retriedResult)).toEqual([]);
    expect(importScenarioModule).toHaveBeenCalledTimes(2);
  });

  it("returns module_load_failed with a string rejection message when the dynamic import rejects", async () => {
    vi.stubEnv("DEV", true);
    vi.spyOn(DEV_SCENARIO_MODULE_IMPORTERS, DEV_SCENARIO_ID.openSubscriptionsIndex).mockRejectedValueOnce(
      "String import failure",
    );

    const result = await loadRuntimeDevScenariosResult();

    expect(expectResultError(result)).toEqual({
      type: "module_load_failed",
      message: "String import failure",
    });
  });

  it("retries module loading after an invalid module", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {};

    // Invalid-module recovery depends on the first load not poisoning the next one.
    const invalidResult = await loadRuntimeDevScenariosResult();
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => []),
      runDevScenario: vi.fn(async () => {}),
    };
    const retriedResult = await loadRuntimeDevScenariosResult();

    expect(expectResultError(invalidResult)).toEqual({
      type: "invalid_module",
      message: "Dev scenarios module does not match the expected runtime interface.",
    });
    expect(expectResultValue(retriedResult)).toEqual([]);
  });

  it.each([undefined, "", new Error("")] as const)(
    "uses the runtime fallback message when module listing throws %s",
    async (thrownValue) => {
      vi.stubEnv("DEV", true);
      devScenariosModuleMock.module = {
        listDevScenarios: vi.fn(() => {
          throw thrownValue;
        }),
        runDevScenario: vi.fn(async () => {}),
      };

      const result = await loadRuntimeDevScenariosResult();

      expect(expectResultError(result)).toEqual({
        type: "module_load_failed",
        message: "Unknown dev scenario runtime error.",
      });
    },
  );

  it("returns module_load_failed when scenario listing throws an Error", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => {
        throw new Error("Scenario listing failed");
      }),
      runDevScenario: vi.fn(async () => {}),
    };

    const result = await loadRuntimeDevScenariosResult();

    expect(expectResultError(result)).toEqual({
      type: "module_load_failed",
      message: "Scenario listing failed",
    });
  });

  it.each([
    {
      name: "unknown scenario id",
      scenarios: [{ id: "unknown-scenario", title: "Broken scenario", keywords: ["broken"] }],
      message: "Dev scenario metadata contains an unknown id.",
    },
    {
      name: "blank title",
      scenarios: [{ id: DEV_SCENARIO_ID.openSubscriptionsIndex, title: " ", keywords: ["subscriptions"] }],
      message: "Dev scenario metadata contains a blank title.",
    },
    {
      name: "non-array keywords",
      scenarios: [{ id: DEV_SCENARIO_ID.openSubscriptionsIndex, title: "Open subscriptions", keywords: "broken" }],
      message: "Dev scenario metadata keywords must be a string array.",
    },
  ] as const)("returns invalid_module when scenario metadata has $name", async ({ scenarios, message }) => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => scenarios),
      runDevScenario: vi.fn(async () => {}),
    };

    const result = await loadRuntimeDevScenariosResult();

    expect(expectResultError(result)).toEqual({
      type: "invalid_module",
      message,
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

    expect(expectResultError(result)).toEqual({
      type: "scenario_failed",
      message: "Scenario action failed",
    });
  });

  it.each([undefined, "", new Error("")] as const)(
    "uses the runtime fallback message when the scenario runner rejects %s",
    async (thrownValue) => {
      vi.stubEnv("DEV", true);
      devScenariosModuleMock.module = {
        listDevScenarios: vi.fn(() => []),
        runDevScenario: vi.fn(async () => {
          throw thrownValue;
        }),
      };

      const result = await runRuntimeDevScenarioResult(DEV_SCENARIO_ID.openSubscriptionsIndex);

      expect(expectResultError(result)).toEqual({
        type: "scenario_failed",
        message: "Unknown dev scenario runtime error.",
      });
    },
  );

  it("rejects promise wrappers with the scenario failure fallback message", async () => {
    vi.stubEnv("DEV", true);
    devScenariosModuleMock.module = {
      listDevScenarios: vi.fn(() => []),
      runDevScenario: vi.fn(async () => {
        throw undefined;
      }),
    };

    await expect(runRuntimeDevScenario(DEV_SCENARIO_ID.openSubscriptionsIndex)).rejects.toThrow(
      "Unknown dev scenario runtime error.",
    );
  });
});
