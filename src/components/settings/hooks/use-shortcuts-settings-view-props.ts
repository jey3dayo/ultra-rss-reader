import type { TFunction } from "i18next";
import type { PlatformInfo } from "@/api/schemas";
import {
  formatKeyForDisplay,
  type ShortcutActionId,
  type ShortcutCategoryKey,
  shortcutDefinitions,
} from "@/lib/keyboard/keyboard-shortcuts";
import type { ShortcutsSettingsViewProps } from "../shortcuts-settings-view";

type ShortcutDefinition = (typeof shortcutDefinitions)[number];
type ShortcutCategory = ShortcutsSettingsViewProps["categories"][number];
type ShortcutCategoryItem = ShortcutCategory["items"][number];

type UseShortcutsSettingsViewPropsParams = {
  t: TFunction<"settings">;
  tReader: TFunction<"reader">;
  platformKind: PlatformInfo["kind"];
  recordingId: ShortcutActionId | null;
  conflictMessage: string | null;
  hasCustomBindings: boolean;
  getKey: (id: ShortcutActionId) => string;
  findConflict: (targetId: ShortcutActionId, key: string) => string | null;
  onResetAll: () => void;
  onResetShortcut: (id: ShortcutActionId) => void;
  onStartRecording: (id: ShortcutActionId) => void;
  onBadgeKeyDown: (id: ShortcutActionId, event: globalThis.KeyboardEvent) => void;
};

export function buildShortcutCategoryOrder(
  definitions: readonly Pick<ShortcutDefinition, "categoryKey">[],
): ShortcutCategoryKey[] {
  const categories: ShortcutCategoryKey[] = [];
  const seenCategories = new Set<ShortcutCategoryKey>();

  for (const definition of definitions) {
    if (seenCategories.has(definition.categoryKey)) {
      continue;
    }

    seenCategories.add(definition.categoryKey);
    categories.push(definition.categoryKey);
  }

  return categories;
}

function buildShortcutCategories(
  definitions: readonly ShortcutDefinition[],
  buildItem: (definition: ShortcutDefinition) => ShortcutCategoryItem,
  getHeading: (category: ShortcutCategoryKey) => string,
): ShortcutCategory[] {
  const categoryIndexes = new Map<ShortcutCategoryKey, number>();
  const categories: ShortcutCategory[] = [];

  for (const definition of definitions) {
    let categoryIndex = categoryIndexes.get(definition.categoryKey);

    if (categoryIndex === undefined) {
      categoryIndex = categories.length;
      categoryIndexes.set(definition.categoryKey, categoryIndex);
      categories.push({
        id: definition.categoryKey,
        heading: getHeading(definition.categoryKey),
        items: [],
      });
    }

    categories[categoryIndex].items.push(buildItem(definition));
  }

  return categories;
}

export function useShortcutsSettingsViewProps({
  t,
  tReader,
  platformKind,
  recordingId,
  conflictMessage,
  hasCustomBindings,
  getKey,
  findConflict,
  onResetAll,
  onResetShortcut,
  onStartRecording,
  onBadgeKeyDown,
}: UseShortcutsSettingsViewPropsParams): ShortcutsSettingsViewProps {
  return {
    title: t("shortcuts.heading"),
    conflictMessage,
    pressAKeyLabel: t("shortcuts.press_a_key"),
    resetLabel: t("shortcuts.reset_to_defaults"),
    resetDisabled: !hasCustomBindings,
    onResetAll,
    categories: buildShortcutCategories(
      shortcutDefinitions,
      (definition) => {
        const currentKey = getKey(definition.id);
        const conflict = findConflict(definition.id, currentKey);
        const isLocked = definition.id === "open_settings";
        const label = tReader(definition.labelKey);

        return {
          id: definition.id,
          label,
          displayKey: formatKeyForDisplay(currentKey, platformKind),
          isLocked,
          isRecording: recordingId === definition.id,
          resetDisabled: isLocked || currentKey === definition.defaultKey,
          resetAriaLabel: t("shortcuts.reset_shortcut_aria_label", {
            name: label,
          }),
          conflictLabel: conflict ? t("shortcuts.conflict", { name: conflict }) : null,
          onReset: () => onResetShortcut(definition.id),
          onStartRecording: () => onStartRecording(definition.id),
          onKeyDown: (event: globalThis.KeyboardEvent) => onBadgeKeyDown(definition.id, event),
        };
      },
      (category) => tReader(category),
    ),
  };
}
