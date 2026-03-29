import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionHeading } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import {
  formatKeyForDisplay,
  type ShortcutActionId,
  shortcutDefinitions,
  shortcutPrefKey,
} from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";

function normalizeRecordedKey(e: KeyboardEvent): string | null {
  // Ignore bare modifier keys
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("\u2318");
  if (e.shiftKey) parts.push("Shift");
  parts.push(e.key.length === 1 && e.shiftKey ? e.key.toUpperCase() : e.key);
  return parts.join("+");
}

interface ShortcutKeyBadgeProps {
  actionId: ShortcutActionId;
  currentKey: string;
  isRecording: boolean;
  conflict: string | null;
  onStartRecording: () => void;
  onKeyRecorded: (key: string) => void;
  onCancel: () => void;
  pressAKeyLabel: string;
  conflictLabel: string;
}

function ShortcutKeyBadge({
  actionId,
  currentKey,
  isRecording,
  conflict,
  onStartRecording,
  onKeyRecorded,
  onCancel,
  pressAKeyLabel,
  conflictLabel,
}: ShortcutKeyBadgeProps) {
  const badgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    badgeRef.current?.focus();

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        onCancel();
        return;
      }

      const recorded = normalizeRecordedKey(e);
      if (recorded) {
        onKeyRecorded(recorded);
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isRecording, onCancel, onKeyRecorded]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        ref={badgeRef}
        type="button"
        data-testid={`shortcut-badge-${actionId}`}
        onClick={onStartRecording}
        className={`rounded-md border px-2.5 py-1 font-mono text-sm transition-colors ${
          isRecording
            ? "border-ring bg-ring/20 text-foreground animate-pulse"
            : conflict
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-border bg-muted text-muted-foreground hover:border-ring hover:bg-ring/10 cursor-pointer"
        }`}
      >
        {isRecording ? pressAKeyLabel : formatKeyForDisplay(currentKey)}
      </button>
      {conflict && !isRecording && <span className="text-[10px] text-destructive">{conflictLabel}</span>}
    </div>
  );
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
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("shortcuts.heading")}</h2>

      {conflictMessage && (
        <div className="mb-4 rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {conflictMessage}
        </div>
      )}

      {categories.map((cat) => (
        <section key={cat} className="mb-6">
          <SectionHeading>{tReader(cat)}</SectionHeading>
          {shortcutDefinitions
            .filter((d) => d.categoryKey === cat)
            .map((def) => {
              const currentKey = getKey(def.id);
              const conflict = findConflict(def.id, currentKey);

              return (
                <div
                  key={def.id}
                  className="flex min-h-[44px] items-center justify-between border-b border-border py-3"
                >
                  <span className="text-sm text-foreground">{tReader(def.labelKey)}</span>
                  {def.id === "open_settings" ? (
                    <kbd className="rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-sm text-muted-foreground">
                      {formatKeyForDisplay(currentKey)}
                    </kbd>
                  ) : (
                    <ShortcutKeyBadge
                      actionId={def.id}
                      currentKey={currentKey}
                      isRecording={recordingId === def.id}
                      conflict={conflict}
                      onStartRecording={() => handleStartRecording(def.id)}
                      onKeyRecorded={(key) => handleKeyRecorded(def.id, key)}
                      onCancel={handleCancel}
                      pressAKeyLabel={t("shortcuts.press_a_key")}
                      conflictLabel={t("shortcuts.conflict", { name: conflict ?? "" })}
                    />
                  )}
                </div>
              );
            })}
        </section>
      ))}

      <div className="flex justify-center border-t border-border pt-6">
        <Button variant="outline" size="sm" onClick={handleResetAll} disabled={!hasCustomBindings}>
          {t("shortcuts.reset_to_defaults")}
        </Button>
      </div>
    </div>
  );
}
