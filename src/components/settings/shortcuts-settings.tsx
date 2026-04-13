import { RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShortcutsSettingsView } from "@/components/settings/shortcuts-settings-view";
import { type ShortcutActionId, shortcutDefinitions, shortcutPrefKey } from "@/lib/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { useShortcutsSettingsViewProps } from "./use-shortcuts-settings-view-props";

type RecordedKeyEvent = Pick<
  globalThis.KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "shiftKey" | "preventDefault" | "stopPropagation"
>;

function normalizeRecordedKey(e: Pick<RecordedKeyEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey">): string | null {
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
  const { t: tReader } = useTranslation("reader");
  const setPref = usePreferencesStore((s) => s.setPref);
  const prefs = usePreferencesStore((s) => s.prefs);
  const platformKind = usePlatformStore((state) => state.platform.kind);

  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);

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
    (id: ShortcutActionId, event: RecordedKeyEvent) => {
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

  const showConfirm = useUiStore((s) => s.showConfirm);

  const doResetAll = useCallback(() => {
    for (const def of shortcutDefinitions) {
      setPref(shortcutPrefKey(def.id), def.defaultKey);
    }
  }, [setPref]);

  const handleResetAll = useCallback(() => {
    showConfirm(t("shortcuts.confirm_reset"), doResetAll, {
      actionLabel: t("shortcuts.reset_to_defaults"),
      icon: RotateCcw,
    });
  }, [showConfirm, doResetAll, t]);

  const hasCustomBindings = shortcutDefinitions.some((def) => {
    const current = prefs[shortcutPrefKey(def.id)];
    return current !== undefined && current !== def.defaultKey;
  });

  const viewProps = useShortcutsSettingsViewProps({
    t,
    tReader,
    platformKind,
    recordingId,
    conflictMessage,
    hasCustomBindings,
    getKey,
    findConflict,
    onResetAll: handleResetAll,
    onStartRecording: handleStartRecording,
    onBadgeKeyDown: handleBadgeKeyDown,
  });

  return <ShortcutsSettingsView {...viewProps} />;
}
