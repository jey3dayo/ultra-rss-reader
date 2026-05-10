import { RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRegisterSettingsDirtyState } from "@/components/settings/hooks/use-settings-dirty-state-registry";
import { ShortcutsSettingsView } from "@/components/settings/shortcuts-settings-view";
import { shouldIgnoreGlobalShortcutKeyboardEvent } from "@/lib/keyboard/global-shortcut-targets";
import {
  formatKeyForDisplay,
  getDefaultShortcutKey,
  getShortcutConflict,
  isLockedShortcutActionId,
  normalizeRecordedShortcutKey,
  type ShortcutActionId,
  shortcutDefinitions,
  shortcutPrefKey,
} from "@/lib/keyboard/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { useShortcutsSettingsViewProps } from "./hooks/use-shortcuts-settings-view-props";

type RecordedKeyEvent = Pick<
  globalThis.KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "isComposing" | "preventDefault" | "stopPropagation"
>;
type ShortcutConflictMessageState = {
  id: ShortcutActionId;
  key: string;
};

function normalizeRecordedKey(
  e: Pick<RecordedKeyEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "isComposing">,
): string | null {
  // Ignore bare modifier keys
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return null;
  if (shouldIgnoreGlobalShortcutKeyboardEvent(e)) return null;

  return normalizeRecordedShortcutKey(e);
}

export function ShortcutsSettings() {
  const { t } = useTranslation("settings");
  const { t: tReader } = useTranslation("reader");
  const setPref = usePreferencesStore((s) => s.setPref);
  const prefs = usePreferencesStore((s) => s.prefs);
  const pendingPreferenceSaves = usePreferencesStore((s) => s.pendingPreferenceSaves);
  const platformKind = usePlatformStore((state) => state.platform.kind);

  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);
  useRegisterSettingsDirtyState({
    owner: "shortcut",
    dirty: recordingId !== null,
    pending: pendingPreferenceSaves > 0,
    blockingReason:
      pendingPreferenceSaves > 0 ? "shortcut-save-pending" : recordingId !== null ? "shortcut-recording" : null,
  });

  const getKey = useCallback(
    (id: ShortcutActionId) => {
      if (isLockedShortcutActionId(id)) {
        return getDefaultShortcutKey(id);
      }

      return prefs[shortcutPrefKey(id)] ?? getDefaultShortcutKey(id);
    },
    [prefs],
  );

  const findConflict = useCallback(
    (targetId: ShortcutActionId, key: string): string | null => {
      const conflict = getShortcutConflict(targetId, key, prefs);

      if (conflict?.type === "native_menu") {
        return "native menu";
      }

      if (conflict?.type === "shortcuts_help") {
        return tReader("shortcuts.open_shortcuts_help");
      }

      if (conflict?.type === "duplicate") {
        const definition = shortcutDefinitions.find((shortcut) => shortcut.id === conflict.actionId);
        return definition ? tReader(definition.labelKey) : null;
      }

      return null;
    },
    [prefs, tReader],
  );

  const handleStartRecording = useCallback((id: ShortcutActionId) => {
    setConflictMessageState(null);
    setRecordingId(id);
  }, []);

  const [conflictMessageState, setConflictMessageState] = useState<ShortcutConflictMessageState | null>(null);
  const conflictMessage = useMemo(() => {
    if (!conflictMessageState) {
      return null;
    }

    const conflict = findConflict(conflictMessageState.id, conflictMessageState.key);
    if (!conflict) {
      return null;
    }

    return t("shortcuts.conflict_message", {
      key: formatKeyForDisplay(conflictMessageState.key, platformKind),
      name: conflict,
    });
  }, [conflictMessageState, findConflict, platformKind, t]);

  const handleKeyRecorded = useCallback(
    (id: ShortcutActionId, key: string) => {
      const conflict = findConflict(id, key);
      if (conflict) {
        setConflictMessageState({ id, key });
      } else {
        setConflictMessageState(null);
        setPref(shortcutPrefKey(id), key);
      }
      setRecordingId(null);
    },
    [findConflict, setPref],
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
    setConflictMessageState(null);
    setRecordingId(null);
    for (const def of shortcutDefinitions) {
      if (isLockedShortcutActionId(def.id)) {
        continue;
      }

      setPref(shortcutPrefKey(def.id), def.defaultKey);
    }
  }, [setPref]);

  const handleResetAll = useCallback(() => {
    showConfirm(t("shortcuts.confirm_reset"), doResetAll, {
      actionLabel: t("shortcuts.reset_to_defaults"),
      icon: RotateCcw,
    });
  }, [showConfirm, doResetAll, t]);

  const handleResetShortcut = useCallback(
    (id: ShortcutActionId) => {
      const def = shortcutDefinitions.find((shortcut) => shortcut.id === id);
      if (!def || isLockedShortcutActionId(def.id)) {
        return;
      }

      setConflictMessageState(null);
      setRecordingId(null);
      setPref(shortcutPrefKey(def.id), def.defaultKey);
    },
    [setPref],
  );

  const hasCustomBindings = shortcutDefinitions.some((def) => {
    if (isLockedShortcutActionId(def.id)) {
      return false;
    }

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
    onResetShortcut: handleResetShortcut,
    onStartRecording: handleStartRecording,
    onBadgeKeyDown: handleBadgeKeyDown,
  });

  return <ShortcutsSettingsView {...viewProps} />;
}
