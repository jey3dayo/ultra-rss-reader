import { describe, expect, it } from "vitest";
import {
  buildAccountNavItems,
  buildSettingsContentResetKey,
  buildSettingsNavItemModels,
} from "@/components/settings/lib/settings-modal-view-model";

describe("settings modal view model", () => {
  const labels: Record<string, string> = {
    "nav.general": "General",
    "nav.reading": "Reading",
    "nav.appearance": "Appearance",
    "nav.mute": "Mute",
    "nav.tags": "Tags",
    "nav.shortcuts": "Shortcuts",
    "nav.actions": "Actions & Sharing",
    "nav.data": "Data Management",
    "nav.debug": "Debug",
  };
  const t = (key: string) => labels[key] ?? key;

  it("orders settings categories by expected usage frequency", () => {
    const navItems = buildSettingsNavItemModels({
      t,
      devBuild: true,
      settingsCategory: "general",
      settingsAccountId: null,
      settingsAddAccount: false,
    });

    expect(navItems.map((item) => item.label)).toEqual([
      "General",
      "Reading",
      "Appearance",
      "Mute",
      "Tags",
      "Shortcuts",
      "Actions & Sharing",
      "Data Management",
      "Debug",
    ]);
  });

  it("omits the debug category outside development builds", () => {
    const navItems = buildSettingsNavItemModels({
      t,
      devBuild: false,
      settingsCategory: "general",
      settingsAccountId: null,
      settingsAddAccount: false,
    });

    expect(navItems.map((item) => item.label)).toEqual([
      "General",
      "Reading",
      "Appearance",
      "Mute",
      "Tags",
      "Shortcuts",
      "Actions & Sharing",
      "Data Management",
    ]);
  });

  it("builds structured content reset keys for account ids containing delimiters", () => {
    const browseKey = buildSettingsContentResetKey({
      settingsCategory: "general",
      settingsAccountId: "acc:add:FreshRss",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
    });
    const addAccountKey = buildSettingsContentResetKey({
      settingsCategory: "general",
      settingsAccountId: "acc:add",
      settingsAddAccount: true,
      settingsAddAccountInitialKind: "FreshRss",
    });

    expect(JSON.parse(browseKey)).toEqual({
      category: "general",
      accountId: "acc:add:FreshRss",
      mode: { type: "browse" },
    });
    expect(JSON.parse(addAccountKey)).toEqual({
      category: "general",
      accountId: "acc:add",
      mode: { type: "add", initialKind: "FreshRss" },
    });
    expect(browseKey).not.toBe(addAccountKey);
  });

  it("changes content reset keys only when the routed content identity changes", () => {
    const baseParams = {
      settingsCategory: "general" as const,
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
    };

    const generalKey = buildSettingsContentResetKey(baseParams);
    const loadingKey = buildSettingsContentResetKey(baseParams);
    const accountKey = buildSettingsContentResetKey({ ...baseParams, settingsAccountId: "acc-1" });
    const addPickKey = buildSettingsContentResetKey({ ...baseParams, settingsAddAccount: true });
    const addFreshRssKey = buildSettingsContentResetKey({
      ...baseParams,
      settingsAddAccount: true,
      settingsAddAccountInitialKind: "FreshRss",
    });

    expect(loadingKey).toBe(generalKey);
    expect(accountKey).not.toBe(generalKey);
    expect(addPickKey).not.toBe(generalKey);
    expect(addFreshRssKey).not.toBe(addPickKey);
  });

  it("builds account navigation item models from account DTOs", () => {
    expect(
      buildAccountNavItems({
        accounts: [
          {
            id: "acc-1",
            name: "FreshRSS",
            kind: "FreshRss",
            username: "alice",
            server_url: "https://freshrss.example.com",
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          },
        ],
        settingsAccountId: "acc-1",
      }),
    ).toEqual([
      {
        id: "acc-1",
        name: "FreshRSS",
        kind: "FreshRss",
        username: "alice",
        serverUrl: "https://freshrss.example.com",
        isActive: true,
      },
    ]);
  });
});
