import { useEffect, useRef } from "react";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Button } from "@/components/ui/button";

export type ShortcutsSettingsItem = {
  id: string;
  label: string;
  displayKey: string;
  isRecording: boolean;
  isLocked?: boolean;
  conflictLabel?: string | null;
  onStartRecording?: () => void;
  onKeyDown?: (event: globalThis.KeyboardEvent) => void;
};

export type ShortcutsSettingsCategory = {
  id: string;
  heading: string;
  items: ShortcutsSettingsItem[];
};

export type ShortcutsSettingsViewProps = {
  title: string;
  categories: ShortcutsSettingsCategory[];
  conflictMessage: string | null;
  pressAKeyLabel: string;
  resetLabel: string;
  resetDisabled: boolean;
  onResetAll: () => void;
};

export type ShortcutKeyBadgeProps = {
  item: ShortcutsSettingsItem;
  pressAKeyLabel: string;
};

function ShortcutKeyBadge({ item, pressAKeyLabel }: ShortcutKeyBadgeProps) {
  const badgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!item.isRecording) return;

    badgeRef.current?.focus();

    const handler = (event: globalThis.KeyboardEvent) => {
      item.onKeyDown?.(event);
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [item.isRecording, item.onKeyDown]);

  return (
    <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
      <button
        ref={badgeRef}
        type="button"
        data-testid={`shortcut-badge-${item.id}`}
        onClick={item.onStartRecording}
        className={`w-full rounded-md border px-2.5 py-1 text-center font-mono text-[13px] font-medium leading-none tracking-[0.02em] transition-colors sm:w-auto ${
          item.isRecording
            ? "animate-pulse border-ring bg-ring/14 text-foreground"
            : item.conflictLabel
              ? "border-state-danger-border bg-state-danger-surface text-state-danger-foreground"
              : "cursor-pointer border-border/70 bg-surface-1 text-foreground-soft hover:border-border-strong hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        {item.isRecording ? pressAKeyLabel : item.displayKey}
      </button>
      {item.conflictLabel && !item.isRecording && (
        <span className="text-[10px] text-state-danger-foreground">{item.conflictLabel}</span>
      )}
    </div>
  );
}

export function ShortcutsSettingsView({
  title,
  categories,
  conflictMessage,
  pressAKeyLabel,
  resetLabel,
  resetDisabled,
  onResetAll,
}: ShortcutsSettingsViewProps) {
  return (
    <SettingsContentLayout title={title} outerTestId="shortcuts-settings-root">
      <div className="mb-5 flex justify-end sm:mb-6">
        <Button variant="outline" onClick={onResetAll} disabled={resetDisabled} className="h-10 w-full px-4 sm:w-auto">
          {resetLabel}
        </Button>
      </div>
      {conflictMessage && (
        <div className="mb-4 rounded-md border border-state-danger-border bg-state-danger-surface px-4 py-2 text-sm text-state-danger-foreground">
          {conflictMessage}
        </div>
      )}

      {categories.map((category) => (
        <SettingsSection key={category.id} heading={category.heading} surface="flat" className="mb-5">
          {category.items.map((item) => (
            <LabeledControlRow
              key={item.id}
              label={item.label}
              className="flex-col items-stretch sm:flex-row sm:items-center"
            >
              {item.isLocked ? (
                <kbd className="w-full rounded-md border border-border/70 bg-surface-1 px-2.5 py-1 text-center font-mono text-[13px] font-medium leading-none tracking-[0.02em] text-foreground-soft sm:w-auto">
                  {item.displayKey}
                </kbd>
              ) : (
                <ShortcutKeyBadge item={item} pressAKeyLabel={pressAKeyLabel} />
              )}
            </LabeledControlRow>
          ))}
        </SettingsSection>
      ))}
    </SettingsContentLayout>
  );
}
