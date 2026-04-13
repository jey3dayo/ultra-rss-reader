import type { TFunction } from "i18next";
import type { PlatformInfo } from "@/api/schemas";
import { formatKeyForDisplay, type ShortcutActionId, shortcutDefinitions } from "@/lib/keyboard-shortcuts";
import type { ShortcutsSettingsViewProps } from "./shortcuts-settings-view";

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
  onStartRecording: (id: ShortcutActionId) => void;
  onBadgeKeyDown: (id: ShortcutActionId, event: globalThis.KeyboardEvent) => void;
};

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
  onStartRecording,
  onBadgeKeyDown,
}: UseShortcutsSettingsViewPropsParams): ShortcutsSettingsViewProps {
  const categories = [...new Set(shortcutDefinitions.map((definition) => definition.categoryKey))];

  return {
    title: t("shortcuts.heading"),
    conflictMessage,
    pressAKeyLabel: t("shortcuts.press_a_key"),
    resetLabel: t("shortcuts.reset_to_defaults"),
    resetDisabled: !hasCustomBindings,
    onResetAll,
    categories: categories.map((category) => ({
      id: category,
      heading: tReader(category),
      items: shortcutDefinitions
        .filter((definition) => definition.categoryKey === category)
        .map((definition) => {
          const currentKey = getKey(definition.id);
          const conflict = findConflict(definition.id, currentKey);

          return {
            id: definition.id,
            label: tReader(definition.labelKey),
            displayKey: formatKeyForDisplay(currentKey, platformKind),
            isLocked: definition.id === "open_settings",
            isRecording: recordingId === definition.id,
            conflictLabel: conflict ? t("shortcuts.conflict", { name: conflict }) : null,
            onStartRecording: () => onStartRecording(definition.id),
            onKeyDown: (event: globalThis.KeyboardEvent) => onBadgeKeyDown(definition.id, event),
          };
        }),
    })),
  };
}
