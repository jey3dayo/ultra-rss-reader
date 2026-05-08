import { type ButtonHTMLAttributes, forwardRef, type ReactNode, useEffect, useRef } from "react";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { cn } from "@/lib/utils";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";

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

export type ShortcutKeyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  conflict?: boolean;
  recording?: boolean;
};

export const ShortcutKeyButton = forwardRef<HTMLButtonElement, ShortcutKeyButtonProps>(
  ({ children, className, conflict = false, recording = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-md border px-2.5 py-1 text-center font-mono text-[13px] leading-none font-medium tracking-[0.02em] transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-auto motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        recording
          ? "animate-pulse border-ring bg-ring/14 text-foreground"
          : conflict
            ? "border-state-danger-border bg-state-danger-surface text-state-danger-foreground"
            : "cursor-pointer border-border/70 bg-surface-1 text-foreground-soft hover:border-border-strong hover:bg-surface-2 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

ShortcutKeyButton.displayName = "ShortcutKeyButton";

function ShortcutKeyBadge({ item, pressAKeyLabel }: ShortcutKeyBadgeProps) {
  const badgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!item.isRecording) return;

    badgeRef.current?.focus();

    const handler = createKeyboardEventListener((event) => {
      item.onKeyDown?.(event);
    });

    return bindWindowEvents([{ type: "keydown", listener: handler, options: true }]);
  }, [item.isRecording, item.onKeyDown]);

  return (
    <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
      <ShortcutKeyButton
        ref={badgeRef}
        data-testid={`shortcut-badge-${item.id}`}
        onClick={item.onStartRecording}
        recording={item.isRecording}
        conflict={Boolean(item.conflictLabel)}
      >
        {item.isRecording ? pressAKeyLabel : item.displayKey}
      </ShortcutKeyButton>
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
        <SettingsActionButton tone="header" onClick={onResetAll} disabled={resetDisabled}>
          {resetLabel}
        </SettingsActionButton>
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
