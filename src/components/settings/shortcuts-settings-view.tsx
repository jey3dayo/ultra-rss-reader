import { useEffect, useRef } from "react";
import { SectionHeading } from "@/components/settings/settings-components";
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

function ShortcutKeyBadge({ item, pressAKeyLabel }: { item: ShortcutsSettingsItem; pressAKeyLabel: string }) {
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
    <div className="flex flex-col items-end gap-1">
      <button
        ref={badgeRef}
        type="button"
        data-testid={`shortcut-badge-${item.id}`}
        onClick={item.onStartRecording}
        className={`rounded-md border px-2.5 py-1 font-mono text-sm transition-colors ${
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
      <div className="mb-6 flex items-center justify-between">
        <div />
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button variant="outline" size="sm" onClick={onResetAll} disabled={resetDisabled}>
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
            <div key={item.id} className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
              <span className="text-sm text-foreground">{item.label}</span>
              {item.isLocked ? (
                <kbd className="rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-sm text-muted-foreground">
                  {item.displayKey}
                </kbd>
              ) : (
                <ShortcutKeyBadge item={item} pressAKeyLabel={pressAKeyLabel} />
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
