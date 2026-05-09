import { describe, expect, it, vi } from "vitest";
import { createDevScenarioRegistryIndex, getDevScenario, listDevScenarios } from "@/dev/scenarios/registry";
import type { DevScenarioContext } from "@/dev/scenarios/types";
import { DEV_SCENARIO_ID, DEV_SCENARIO_IDS } from "@/dev/scenarios/types";

function createScenarioContext(): DevScenarioContext {
  return {
    ui: {
      selectedAccountId: "acc-freshrss",
      showToast: vi.fn(),
      selectAccount: vi.fn(),
      selectFeed: vi.fn(),
      selectFolder: vi.fn(),
      selectSmartView: vi.fn(),
      selectTag: vi.fn(),
      selectAll: vi.fn(),
      selectArticle: vi.fn(),
      openBrowser: vi.fn(),
      setViewMode: vi.fn(),
      openSettings: vi.fn(),
      openAddFeedDialog: vi.fn(),
      openCommandPalette: vi.fn(),
      openShortcutsHelp: vi.fn(),
      closeCommandPalette: vi.fn(),
      toggleCommandPalette: vi.fn(),
    },
    queryClient: {
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
    },
    actions: {
      executeAction: vi.fn(),
      listAccounts: vi.fn().mockReturnValue([]),
      listFeeds: vi.fn().mockReturnValue([]),
      listArticles: vi.fn().mockReturnValue([]),
      listTags: vi.fn().mockReturnValue([]),
      getTagArticleCounts: vi.fn().mockReturnValue({}),
      listArticlesByTag: vi.fn().mockReturnValue([]),
    },
  };
}

describe("dev scenario registry", () => {
  it("lists the registered scenario ids", () => {
    expect(listDevScenarios().map((scenario) => scenario.id)).toEqual(DEV_SCENARIO_IDS);
  });

  it("keeps scenario ids and titles unique", () => {
    const registryIndex = createDevScenarioRegistryIndex(listDevScenarios());

    expect(registryIndex.duplicateIds).toEqual([]);
    expect(registryIndex.duplicateTitles).toEqual([]);
  });

  it("keeps keywords unique within each scenario", () => {
    expect(createDevScenarioRegistryIndex(listDevScenarios()).duplicateKeywordsByScenarioId).toEqual([]);
  });

  it("builds a stable scenario id index for registry lookups and diagnostics", () => {
    const scenarios = listDevScenarios();
    const registryIndex = createDevScenarioRegistryIndex(scenarios);

    expect([...registryIndex.ids]).toEqual(DEV_SCENARIO_IDS);
    expect(registryIndex.scenarios.map((scenario) => scenario.id)).toEqual(DEV_SCENARIO_IDS);
    expect(registryIndex.scenarioById.get(DEV_SCENARIO_ID.openCommandPalette)).toMatchObject({
      id: DEV_SCENARIO_ID.openCommandPalette,
      title: "Open command palette",
    });
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

  it("keeps command palette scenario action-backed and separate from browser geometry", async () => {
    const context = createScenarioContext();

    await getDevScenario(DEV_SCENARIO_ID.openCommandPalette)?.run(context);

    expect(context.actions.executeAction).toHaveBeenCalledWith("open-command-palette");
    expect(context.ui.openBrowser).not.toHaveBeenCalled();
  });

  it("keeps browser geometry scenario browser-backed and separate from command palette actions", async () => {
    const context = createScenarioContext();

    await getDevScenario(DEV_SCENARIO_ID.openWebPreviewGeometryCheck)?.run(context);

    expect(context.ui.openBrowser).toHaveBeenCalledTimes(1);
    expect(context.ui.openBrowser).toHaveBeenCalledWith(expect.stringContaining("dev-web-preview-geometry"));
    expect(context.actions.executeAction).not.toHaveBeenCalled();
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
