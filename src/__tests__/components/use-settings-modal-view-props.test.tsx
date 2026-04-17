import { render, screen } from "@testing-library/react";
import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";
import { useSettingsModalViewProps } from "@/components/settings/use-settings-modal-view-props";

describe("useSettingsModalViewProps", () => {
  const t = ((key: string) =>
    (
      ({
        preferences: "Settings",
        close_preferences: "Close settings",
        accounts_heading: "Accounts",
        add_account_ellipsis: "Add account…",
        "nav.general": "General",
        "nav.reading": "Reading",
        "nav.appearance": "Appearance",
        "nav.mute": "Mute",
        "nav.tags": "Tags",
        "nav.shortcuts": "Shortcuts",
        "nav.actions": "Actions & Sharing",
        "nav.data": "Data Management",
        "nav.debug": "Debug",
      }) as Record<string, string>
    )[key] ?? key) as unknown as TFunction<"settings">;

  it("orders settings categories by expected usage frequency", () => {
    const viewProps = useSettingsModalViewProps({
      t,
      devBuild: true,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsLoading: false,
      accounts: [],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      setSettingsAccountId: vi.fn(),
      setSettingsAddAccount: vi.fn(),
    });

    render(viewProps.navigation);

    expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
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
    const viewProps = useSettingsModalViewProps({
      t,
      devBuild: false,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsLoading: false,
      accounts: [],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      setSettingsAccountId: vi.fn(),
      setSettingsAddAccount: vi.fn(),
    });

    render(viewProps.navigation);

    expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
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
});
