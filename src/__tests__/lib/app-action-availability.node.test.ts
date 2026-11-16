import { describe, expect, it } from "vitest";
import {
  APP_ACTIONS,
  type AppAction,
  type AppActionAvailabilityContext,
  type AppActionSurface,
  getAppActionUnavailableReason,
} from "@/lib/app-actions";

const idleContext: AppActionAvailabilityContext = {
  selectedAccountId: "acc-1",
  selectedArticleId: "art-1",
  contentMode: "reader",
  commandPaletteOpen: false,
  settingsOpen: false,
  shortcutsHelpOpen: false,
  isAddFeedDialogOpen: false,
};

const articleScopedMenuActions = [
  "open-in-reader",
  "open-in-browser",
  "toggle-star",
  "toggle-read",
  "copy-link",
  "open-in-default-browser",
  "add-to-reading-list",
] as const satisfies readonly AppAction[];

const modalAllowedMenuActions: readonly AppAction[] = [
  "check-for-updates",
  "sync-all",
  "toggle-fullscreen",
  "toggle-sort-unread",
  "toggle-group-by-feed",
];

const modalStates = [
  ["settings", { settingsOpen: true }],
  ["confirm dialog", { confirmDialogOpen: true }],
  ["shortcuts help", { shortcutsHelpOpen: true }],
  ["command palette", { commandPaletteOpen: true }],
  ["add-feed dialog", { isAddFeedDialogOpen: true }],
] as const satisfies readonly (readonly [string, Partial<AppActionAvailabilityContext>])[];

describe("native menu action availability", () => {
  it.each(articleScopedMenuActions)("rejects %s without a selected article as requires-article", (action) => {
    expect(getAppActionUnavailableReason(action, "nativeMenu", { ...idleContext, selectedArticleId: null })).toBe(
      "requires-article",
    );
    expect(getAppActionUnavailableReason(action, "nativeMenu", idleContext)).toBeNull();
  });

  it.each(modalStates)(
    "rejects everything except the update check, sync, fullscreen and the native check menu toggles while the %s is open",
    (_label, modalState) => {
      const context = { ...idleContext, ...modalState };

      for (const action of APP_ACTIONS) {
        expect(getAppActionUnavailableReason(action, "nativeMenu", context)).toBe(
          modalAllowedMenuActions.includes(action) ? null : "modal-open",
        );
      }
    },
  );

  it("reports modal-open before requires-article", () => {
    expect(
      getAppActionUnavailableReason("toggle-star", "nativeMenu", {
        ...idleContext,
        selectedArticleId: null,
        settingsOpen: true,
      }),
    ).toBe("modal-open");
  });
});

describe("non-menu surfaces", () => {
  const otherSurfaces = [
    "commandPalette",
    "dispatcher",
    "keyboardShortcut",
  ] as const satisfies readonly AppActionSurface[];

  it.each(otherSurfaces)("%s ignores the confirm dialog state", (surface) => {
    for (const action of APP_ACTIONS) {
      expect(getAppActionUnavailableReason(action, surface, { ...idleContext, confirmDialogOpen: true })).toBe(
        getAppActionUnavailableReason(action, surface, idleContext),
      );
    }
  });

  it.each(otherSurfaces)("%s still lets settings and the command palette through a modal", (surface) => {
    const context = { ...idleContext, settingsOpen: true };
    expect(getAppActionUnavailableReason("open-settings", surface, context)).toBeNull();
    expect(getAppActionUnavailableReason("open-command-palette", surface, context)).toBeNull();
    expect(getAppActionUnavailableReason("sync-all", surface, context)).toBe("modal-open");
  });
});
