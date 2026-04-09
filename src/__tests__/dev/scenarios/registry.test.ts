import { describe, expect, it } from "vitest";
import { getDevScenario, listDevScenarios } from "@/dev/scenarios/registry";
import { DEV_SCENARIO_IDS } from "@/dev/scenarios/types";

describe("dev scenario registry", () => {
  it("lists the registered scenario ids", () => {
    expect(listDevScenarios().map((scenario) => scenario.id)).toEqual(DEV_SCENARIO_IDS);
  });

  it("returns a registered scenario for a known id", () => {
    expect(getDevScenario("open-settings-reading")).toMatchObject({
      id: "open-settings-reading",
      title: "Open settings reading",
    });
  });

  it("registers the display-mode showcase scenario", () => {
    expect(getDevScenario("open-settings-reading-display-mode")).toMatchObject({
      id: "open-settings-reading-display-mode",
      title: "Open settings reading display mode",
    });
  });

  it("returns null for an unknown id", () => {
    expect(getDevScenario("unknown-scenario")).toBeNull();
  });
});
