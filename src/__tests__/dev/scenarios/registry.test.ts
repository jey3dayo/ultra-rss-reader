import { describe, expect, it } from "vitest";
import { getDevScenario, listDevScenarios } from "@/dev/scenarios/registry";
import { DEV_SCENARIO_IDS } from "@/dev/scenarios/types";

describe("dev scenario registry", () => {
  it("lists the registered scenario ids", () => {
    expect(listDevScenarios().map((scenario) => scenario.id)).toEqual(DEV_SCENARIO_IDS);
  });

  it("returns a registered scenario for a known id", () => {
    expect(getDevScenario(DEV_SCENARIO_IDS[3])).toMatchObject({
      id: DEV_SCENARIO_IDS[3],
      title: "Open settings reading",
    });
  });

  it("returns null for an unknown id", () => {
    expect(getDevScenario("unknown-scenario")).toBeNull();
  });
});
