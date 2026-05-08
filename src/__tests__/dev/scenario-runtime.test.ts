import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import {
  loadRuntimeDevScenarios,
  loadRuntimeDevScenariosResult,
  runRuntimeDevScenario,
  runRuntimeDevScenarioResult,
} from "@/dev/scenario-runtime";

describe("dev-scenario-runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
});
