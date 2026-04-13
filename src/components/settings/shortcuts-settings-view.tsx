import { useEffect, useRef } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SectionHeading } from "@/components/shared/section-heading";
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
        className={`w-full rounded-md border px-2.5 py-1 text-center font-mono text-sm transition-colors sm:w-auto ${
          item.isRecording
            ? "animate-pulse border-ring bg-ring/20 text-foreground"
            : item.conflictLabel
              ? "border-destructive bg-destructive/10 text-destructive"
              : "cursor-pointer border-border bg-muted text-muted-foreground hover:border-ring hover:bg-ring/10"
        }`}
      >
        {item.isRecording ? pressAKeyLabel : item.displayKey}
      </button>
      {item.conflictLabel && !item.isRecording && (
        <span className="text-[10px] text-destructive">{item.conflictLabel}</span>
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
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="hidden sm:block" />
        <h2 className="text-center text-lg font-semibold">{title}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onResetAll}
          disabled={resetDisabled}
          className="w-full sm:justify-self-end sm:w-auto"
        >
          {resetLabel}
        </Button>
      </div>

      {conflictMessage && (
        <div className="mb-4 rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {conflictMessage}
        </div>
      )}

      {categories.map((category) => (
        <section key={category.id} className="mb-6">
          <SectionHeading>{category.heading}</SectionHeading>
          {category.items.map((item) => (
            <LabeledControlRow
              key={item.id}
              label={item.label}
              className="flex-col items-stretch sm:flex-row sm:items-center"
            >
              {item.isLocked ? (
                <kbd className="w-full rounded-md border border-border bg-muted px-2.5 py-1 text-center font-mono text-sm text-muted-foreground sm:w-auto">
                  {item.displayKey}
                </kbd>
              ) : (
                <ShortcutKeyBadge item={item} pressAKeyLabel={pressAKeyLabel} />
              )}
            </LabeledControlRow>
          ))}
        </section>
      ))}
    </div>
  );
}
