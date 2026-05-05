import { describe, expect, it } from "vitest";
import { getDevScenario, listDevScenarios } from "@/dev/scenarios/registry";
import { DEV_SCENARIO_ID, DEV_SCENARIO_IDS } from "@/dev/scenarios/types";

describe("dev scenario registry", () => {
  it("lists the registered scenario ids", () => {
    expect(listDevScenarios().map((scenario) => scenario.id)).toEqual(DEV_SCENARIO_IDS);
  });

  it("returns a registered scenario for a known id", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openSettingsGeneral)).toMatchObject({
      id: DEV_SCENARIO_ID.openSettingsGeneral,
      title: "Open settings general",
    });
  });

  it("registers the accounts add scenario", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openSettingsAccountsAdd)).toMatchObject({
      id: DEV_SCENARIO_ID.openSettingsAccountsAdd,
      title: "Open settings accounts add",
    });
  });

  it("registers the FreshRSS accounts add scenario", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openSettingsAccountsAddFreshRss)).toMatchObject({
      id: DEV_SCENARIO_ID.openSettingsAccountsAddFreshRss,
      title: "Open settings accounts add FreshRSS",
    });
  });

  it("registers the command palette scenario", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openCommandPalette)).toMatchObject({
      id: DEV_SCENARIO_ID.openCommandPalette,
      title: "Open command palette",
    });
  });

  it("registers the shortcuts help scenario", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openShortcutsHelp)).toMatchObject({
      id: DEV_SCENARIO_ID.openShortcutsHelp,
      title: "Open shortcuts help",
    });
  });

  it("registers the web preview geometry check scenario", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openWebPreviewGeometryCheck)).toMatchObject({
      id: DEV_SCENARIO_ID.openWebPreviewGeometryCheck,
      title: "Open web preview geometry check",
    });
  });

  it("registers the display-mode showcase scenario", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openSettingsReadingDisplayMode)).toMatchObject({
      id: DEV_SCENARIO_ID.openSettingsReadingDisplayMode,
      title: "Open settings reading display mode",
    });
  });

  it("keeps renamed settings scenarios searchable by Japanese and previous terms", () => {
    expect(getDevScenario(DEV_SCENARIO_ID.openSettingsGeneral)?.keywords).toEqual(
      expect.arrayContaining(["一般", "サイドバー", "ナビゲーション"]),
    );
    expect(getDevScenario(DEV_SCENARIO_ID.openSettingsReading)?.keywords).toEqual(
      expect.arrayContaining(["閲覧", "記事一覧", "表示"]),
    );
    expect(getDevScenario(DEV_SCENARIO_ID.openSettingsData)?.keywords).toEqual(
      expect.arrayContaining(["データ", "データ管理"]),
    );
  });

  it("returns null for an unknown id", () => {
    expect(getDevScenario("unknown-scenario")).toBeNull();
  });
});
