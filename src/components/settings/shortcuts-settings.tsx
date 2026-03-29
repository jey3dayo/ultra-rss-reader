import type { KeyboardEvent } from "react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShortcutsSettingsView } from "@/components/settings/shortcuts-settings-view";
import {
  formatKeyForDisplay,
  type ShortcutActionId,
  shortcutDefinitions,
  shortcutPrefKey,
} from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";

function normalizeRecordedKey(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey">): string | null {
  // Ignore bare modifier keys
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("\u2318");
  if (e.shiftKey) parts.push("Shift");
  parts.push(e.key.length === 1 && e.shiftKey ? e.key.toUpperCase() : e.key);
  return parts.join("+");
}

export function ShortcutsSettings() {
  const { t } = useTranslation("settings");
  const tReader = useTranslation("reader").t;
  const setPref = usePreferencesStore((s) => s.setPref);
  const prefs = usePreferencesStore((s) => s.prefs);

  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);

  const categories = [...new Set(shortcutDefinitions.map((d) => d.categoryKey))];

  const getKey = useCallback(
    (id: ShortcutActionId) => {
      const def = shortcutDefinitions.find((d) => d.id === id);
      return prefs[shortcutPrefKey(id)] ?? def?.defaultKey ?? "";
    },
    [prefs],
  );

  const findConflict = useCallback(
    (targetId: ShortcutActionId, key: string): string | null => {
      for (const def of shortcutDefinitions) {
        if (def.id === targetId) continue;
        const existingKey = getKey(def.id);
        if (existingKey === key) return tReader(def.labelKey);
      }
      return null;
    },
    [getKey, tReader],
  );

  const handleStartRecording = useCallback((id: ShortcutActionId) => {
    setRecordingId(id);
  }, []);

  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const handleKeyRecorded = useCallback(
    (id: ShortcutActionId, key: string) => {
      const conflict = findConflict(id, key);
      if (conflict) {
        setConflictMessage(t("shortcuts.conflict_message", { key, name: conflict }));
      } else {
        setConflictMessage(null);
        setPref(shortcutPrefKey(id), key);
      }
      setRecordingId(null);
    },
    [findConflict, setPref, t],
  );

  const handleCancel = useCallback(() => {
    setRecordingId(null);
  }, []);

  const handleBadgeKeyDown = useCallback(
    (id: ShortcutActionId, event: KeyboardEvent<HTMLButtonElement>) => {
      if (recordingId !== id) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        handleCancel();
        return;
      }

      const recorded = normalizeRecordedKey(event);
      if (recorded) {
        handleKeyRecorded(id, recorded);
      }
    },
    [handleCancel, handleKeyRecorded, recordingId],
  );

  const handleResetAll = useCallback(() => {
    for (const def of shortcutDefinitions) {
      setPref(shortcutPrefKey(def.id), def.defaultKey);
    }
  }, [setPref]);

  const hasCustomBindings = shortcutDefinitions.some((def) => {
    const current = prefs[shortcutPrefKey(def.id)];
    return current !== undefined && current !== def.defaultKey;
  });

  return (
    <ShortcutsSettingsView
      title={t("shortcuts.heading")}
      conflictMessage={conflictMessage}
      pressAKeyLabel={t("shortcuts.press_a_key")}
      resetLabel={t("shortcuts.reset_to_defaults")}
      resetDisabled={!hasCustomBindings}
      onResetAll={handleResetAll}
      categories={categories.map((category) => ({
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
              displayKey: formatKeyForDisplay(currentKey),
              isLocked: definition.id === "open_settings",
              isRecording: recordingId === definition.id,
              conflictLabel: conflict ? t("shortcuts.conflict", { name: conflict }) : null,
              onStartRecording: () => handleStartRecording(definition.id),
              onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => handleBadgeKeyDown(definition.id, event),
            };
          }),
      }))}
    />
  );
}
