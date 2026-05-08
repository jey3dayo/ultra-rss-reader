import { describe, expect, it, vi } from "vitest";
import {
  buildShortcutCategoryOrder,
  useShortcutsSettingsViewProps,
} from "@/components/settings/hooks/use-shortcuts-settings-view-props";
import type { ShortcutsSettingsViewProps } from "@/components/settings/shortcuts-settings-view";
import i18n from "@/lib/i18n";
import type { ShortcutActionId } from "@/lib/keyboard/keyboard-shortcuts";

const t = i18n.getFixedT("en", "settings");
const tReader = i18n.getFixedT("en", "reader");

function getShortcutItem(props: ShortcutsSettingsViewProps, id: ShortcutActionId) {
  const item = props.categories.flatMap((category) => category.items).find((shortcut) => shortcut.id === id);

  if (!item) {
    throw new Error(`Missing shortcut item: ${id}`);
  }

  return item;
}

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
});
