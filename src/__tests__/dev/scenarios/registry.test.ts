import { describe, expect, it } from "vitest";
import { getDevScenario, listDevScenarios } from "@/dev/scenarios/registry";

describe("dev scenario registry", () => {
  it("lists the registered scenario ids", () => {
    expect(listDevScenarios().map((scenario) => scenario.id)).toEqual([
      "image-viewer-overlay",
      "open-feed-first-article",
      "open-tag-view",
      "open-add-feed-dialog",
      "sync-all-smoke",
    ]);
  });

  it("returns a registered scenario for a known id", () => {
    expect(getDevScenario("open-add-feed-dialog")).toMatchObject({
      id: "open-add-feed-dialog",
      title: "Open add feed dialog",
    });
  });

  it("returns null for an unknown id", () => {
    expect(getDevScenario("unknown-scenario")).toBeNull();
  });
});
