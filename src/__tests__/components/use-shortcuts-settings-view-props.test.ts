import { describe, expect, it, vi } from "vitest";
import {
  buildShortcutCategoryOrder,
  useShortcutsSettingsViewProps,
} from "@/components/settings/hooks/use-shortcuts-settings-view-props";
import type { ShortcutsSettingsViewProps } from "@/components/settings/shortcuts-settings-view";
import i18n from "@/lib/i18n";
import { type ShortcutActionId, shortcutDefinitions } from "@/lib/keyboard/keyboard-shortcuts";

const t = i18n.getFixedT("en", "settings");
const tReader = i18n.getFixedT("en", "reader");

function getShortcutItem(props: ShortcutsSettingsViewProps, id: ShortcutActionId) {
  const item = props.categories.flatMap((category) => category.items).find((shortcut) => shortcut.id === id);

  if (!item) {
    throw new Error(`Missing shortcut item: ${id}`);
  }

  return item;
}

const defaultShortcutKeys = new Map(shortcutDefinitions.map((definition) => [definition.id, definition.defaultKey]));

describe("useShortcutsSettingsViewProps", () => {
  it("builds category order from first appearance and emits duplicate categories once", () => {
    expect(
      buildShortcutCategoryOrder([
        { categoryKey: "shortcuts.category_actions" },
        { categoryKey: "shortcuts.category_navigation" },
        { categoryKey: "shortcuts.category_actions" },
        { categoryKey: "shortcuts.category_global" },
        { categoryKey: "shortcuts.category_navigation" },
      ]),
    ).toEqual(["shortcuts.category_actions", "shortcuts.category_navigation", "shortcuts.category_global"]);
  });

  it("maps reset state, shortcut display, conflicts, and static bindings", () => {
    const onResetAll = vi.fn();

    const props = useShortcutsSettingsViewProps({
      t,
      tReader,
      platformKind: "windows",
      recordingId: "show_unread",
      conflictMessage: "Resolve shortcut conflicts",
      hasCustomBindings: false,
      getKey: (id) => (id === "open_settings" ? "⌘," : id === "show_unread" ? "⌘+1" : ""),
      findConflict: (id) => (id === "show_unread" ? "Toggle read / unread" : null),
      onResetAll,
      onResetShortcut: vi.fn(),
      onStartRecording: vi.fn(),
      onBadgeKeyDown: vi.fn(),
    });

    const showUnread = getShortcutItem(props, "show_unread");
    const openSettings = getShortcutItem(props, "open_settings");

    expect(props).toEqual(
      expect.objectContaining({
        title: t("shortcuts.heading"),
        conflictMessage: "Resolve shortcut conflicts",
        pressAKeyLabel: t("shortcuts.press_a_key"),
        resetLabel: t("shortcuts.reset_to_defaults"),
        resetDisabled: true,
        onResetAll,
      }),
    );
    expect(showUnread).toEqual(
      expect.objectContaining({
        label: tReader("shortcuts.show_unread"),
        displayKey: "Ctrl 1",
        isLocked: false,
        isRecording: true,
        resetAriaLabel: t("shortcuts.reset_shortcut_aria_label", {
          name: tReader("shortcuts.show_unread"),
        }),
        conflictLabel: t("shortcuts.conflict", {
          name: "Toggle read / unread",
        }),
      }),
    );
    expect(openSettings).toEqual(
      expect.objectContaining({
        displayKey: "Ctrl ,",
        isLocked: true,
        isRecording: false,
        conflictLabel: null,
      }),
    );
  });

  it("keeps shortcut category order, labels, and reset disabled state stable", () => {
    const props = useShortcutsSettingsViewProps({
      t,
      tReader,
      platformKind: "macos",
      recordingId: null,
      conflictMessage: null,
      hasCustomBindings: true,
      getKey: (id) => (id === "next_article" ? "Shift+J" : (defaultShortcutKeys.get(id) ?? "")),
      findConflict: () => null,
      onResetAll: vi.fn(),
      onResetShortcut: vi.fn(),
      onStartRecording: vi.fn(),
      onBadgeKeyDown: vi.fn(),
    });

    expect(
      props.categories.map((category) => ({
        id: category.id,
        heading: category.heading,
        items: category.items.map((item) => ({
          id: item.id,
          label: item.label,
          resetDisabled: item.resetDisabled,
        })),
      })),
    ).toEqual([
      {
        id: "shortcuts.category_navigation",
        heading: "shortcuts.category_navigation",
        items: [
          {
            id: "next_article",
            label: "shortcuts.next_article",
            resetDisabled: false,
          },
          {
            id: "prev_article",
            label: "shortcuts.prev_article",
            resetDisabled: true,
          },
          {
            id: "next_feed",
            label: "shortcuts.next_feed",
            resetDisabled: true,
          },
          {
            id: "prev_feed",
            label: "shortcuts.prev_feed",
            resetDisabled: true,
          },
          {
            id: "focus_sidebar",
            label: "shortcuts.focus_sidebar",
            resetDisabled: true,
          },
          {
            id: "toggle_sidebar",
            label: "shortcuts.toggle_sidebar",
            resetDisabled: true,
          },
        ],
      },
      {
        id: "shortcuts.category_actions",
        heading: "shortcuts.category_actions",
        items: [
          {
            id: "reload_webview",
            label: "shortcuts.reload_webview",
            resetDisabled: true,
          },
          {
            id: "toggle_read",
            label: "shortcuts.toggle_read",
            resetDisabled: true,
          },
          {
            id: "toggle_star",
            label: "shortcuts.toggle_star",
            resetDisabled: true,
          },
          {
            id: "open_in_app_browser",
            label: "shortcuts.view_in_browser",
            resetDisabled: true,
          },
          {
            id: "open_external_browser",
            label: "shortcuts.open_external_browser",
            resetDisabled: true,
          },
          {
            id: "mark_all_read",
            label: "shortcuts.mark_all_read",
            resetDisabled: true,
          },
          {
            id: "show_unread",
            label: "shortcuts.show_unread",
            resetDisabled: true,
          },
          {
            id: "show_all",
            label: "shortcuts.show_all",
            resetDisabled: true,
          },
          {
            id: "show_starred",
            label: "shortcuts.show_starred",
            resetDisabled: true,
          },
          {
            id: "cycle_filter",
            label: "shortcuts.cycle_filter",
            resetDisabled: true,
          },
        ],
      },
      {
        id: "shortcuts.category_global",
        heading: "shortcuts.category_global",
        items: [
          {
            id: "search",
            label: "shortcuts.search",
            resetDisabled: true,
          },
          {
            id: "open_command_palette",
            label: "shortcuts.open_command_palette",
            resetDisabled: true,
          },
          {
            id: "close_or_clear",
            label: "shortcuts.close_or_clear",
            resetDisabled: true,
          },
          {
            id: "open_settings",
            label: "shortcuts.open_settings",
            resetDisabled: true,
          },
        ],
      },
    ]);
  });

  it("binds recording and keyboard handlers to each shortcut id", () => {
    const onStartRecording = vi.fn();
    const onBadgeKeyDown = vi.fn();
    const event = new KeyboardEvent("keydown", { key: "j" });

    const props = useShortcutsSettingsViewProps({
      t,
      tReader,
      platformKind: "macos",
      recordingId: null,
      conflictMessage: null,
      hasCustomBindings: true,
      getKey: (id) => (id === "next_article" ? "j" : ""),
      findConflict: () => null,
      onResetAll: vi.fn(),
      onResetShortcut: vi.fn(),
      onStartRecording,
      onBadgeKeyDown,
    });

    const nextArticle = getShortcutItem(props, "next_article");

    expect(props.resetDisabled).toBe(false);
    expect(nextArticle.onStartRecording).toBeDefined();
    expect(nextArticle.onKeyDown).toBeDefined();

    nextArticle.onStartRecording?.();
    nextArticle.onKeyDown?.(event);

    expect(onStartRecording).toHaveBeenCalledWith("next_article");
    expect(onBadgeKeyDown).toHaveBeenCalledWith("next_article", event);
  });

  it("maps ja shortcut reset aria labels from locale keys", () => {
    const tJa = i18n.getFixedT("ja", "settings");
    const tReaderJa = i18n.getFixedT("ja", "reader");

    const props = useShortcutsSettingsViewProps({
      t: tJa,
      tReader: tReaderJa,
      platformKind: "macos",
      recordingId: null,
      conflictMessage: null,
      hasCustomBindings: true,
      getKey: (id) => (id === "next_article" ? "j" : ""),
      findConflict: () => null,
      onResetAll: vi.fn(),
      onResetShortcut: vi.fn(),
      onStartRecording: vi.fn(),
      onBadgeKeyDown: vi.fn(),
    });

    expect(getShortcutItem(props, "next_article").resetAriaLabel).toBe(
      tJa("shortcuts.reset_shortcut_aria_label", {
        name: tReaderJa("shortcuts.next_article"),
      }),
    );
  });
});
