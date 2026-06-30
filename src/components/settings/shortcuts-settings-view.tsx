import { RotateCcw } from "lucide-react";
import { type ComponentPropsWithoutRef, type ReactNode, type Ref, useEffect, useRef } from "react";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS } from "@/components/settings/shared/settings-surface";
import { Kbd } from "@/design-system";
import { cn } from "@/lib/utils";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";

type ShortcutsSettingsItem = {
  id: string;
  label: string;
  displayKey: string;
  isRecording: boolean;
  isLocked?: boolean;
  resetDisabled?: boolean;
  resetAriaLabel?: string;
  conflictLabel?: string | null;
  onReset?: () => void;
  onStartRecording?: () => void;
  onKeyDown?: (event: globalThis.KeyboardEvent) => void;
};

type ShortcutsSettingsCategory = {
  id: string;
  heading: string;
  items: ShortcutsSettingsItem[];
};

export type ShortcutsSettingsViewProps = {
  title: string;
  categories: ShortcutsSettingsCategory[];
  conflictMessage: string | null;
  pressAKeyLabel: string;
  resetAllLabel: string;
  resetDisabled: boolean;
  showLockedReset?: boolean;
  onResetAll: () => void;
};

type ShortcutKeyBadgeProps = {
  item: ShortcutsSettingsItem;
  pressAKeyLabel: string;
  resetDisabled?: boolean;
};

type ShortcutKeyButtonProps = ComponentPropsWithoutRef<"button"> & {
  children: ReactNode;
  conflict?: boolean;
  ref?: Ref<HTMLButtonElement>;
  recording?: boolean;
};

function ShortcutResetButton({
  item,
  disabled = item.resetDisabled,
  forceVisible = false,
}: {
  item: ShortcutsSettingsItem;
  disabled?: boolean;
  forceVisible?: boolean;
}) {
  if (!forceVisible && item.resetDisabled !== false) {
    return null;
  }

  return (
    <button
      type="button"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground-soft/72 transition-colors duration-150 ease-standard hover:bg-surface-2/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none"
      disabled={disabled}
      onClick={item.onReset}
      aria-label={item.resetAriaLabel}
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
    </button>
  );
}

export function ShortcutKeyButton({
  children,
  className,
  conflict = false,
  ref,
  recording = false,
  type = "button",
  ...props
}: ShortcutKeyButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "min-h-8 min-w-10 rounded-md border px-2.5 py-1 text-center font-mono text-[12px] leading-none font-medium tracking-[0.02em] transition-colors duration-150 ease-standard motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        recording
          ? "animate-pulse border-ring bg-ring/14 text-foreground"
          : conflict
            ? "border-state-danger-border bg-state-danger-surface text-state-danger-foreground"
            : cn(
                "cursor-pointer bg-surface-1 text-foreground-soft hover:border-border-strong hover:bg-surface-2 hover:text-foreground",
                SETTINGS_CONTROL_SURFACE_CLASS,
              ),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function ShortcutKeyBadge({ item, pressAKeyLabel, resetDisabled }: ShortcutKeyBadgeProps) {
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
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1">
        <ShortcutResetButton item={item} disabled={resetDisabled} />
        <ShortcutKeyButton
          ref={badgeRef}
          data-testid={`shortcut-badge-${item.id}`}
          onClick={item.onStartRecording}
          recording={item.isRecording}
          conflict={Boolean(item.conflictLabel)}
        >
          {item.isRecording ? pressAKeyLabel : item.displayKey}
        </ShortcutKeyButton>
      </div>
      {item.conflictLabel && !item.isRecording && (
        <span className="max-w-72 break-words text-right text-xs leading-tight text-state-danger-foreground">
          {item.conflictLabel}
        </span>
      )}
    </div>
  );
}

function ShortcutSettingRow({ children, item }: { children: ReactNode; item: ShortcutsSettingsItem }) {
  return (
    <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-border/55 py-1.5 last:border-b-0">
      <span className="min-w-0 truncate font-sans text-[13px] leading-[1.35] font-medium text-[color:var(--form-row-label)]">
        {item.label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ShortcutsSettingsView({
  title,
  categories,
  conflictMessage,
  pressAKeyLabel,
  resetAllLabel,
  resetDisabled,
  showLockedReset = false,
  onResetAll,
}: ShortcutsSettingsViewProps) {
  const hasRecordingShortcut = categories.some((category) => category.items.some((item) => item.isRecording));
  const [firstCategory, secondCategory, ...remainingCategories] = categories;

  const renderCategory = (category: ShortcutsSettingsCategory) => (
    <SettingsSection
      key={category.id}
      heading={category.heading}
      surface="flat"
      className="px-3 py-2.5 sm:px-4 sm:py-3"
      headingClassName="mb-2"
      contentClassName="[&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
    >
      {category.items.map((item) => (
        <ShortcutSettingRow key={item.id} item={item}>
          {item.isLocked ? (
            <div className="flex items-center justify-end gap-1">
              <ShortcutResetButton item={item} disabled={true} forceVisible={showLockedReset} />
              <Kbd
                data-testid={`shortcut-badge-${item.id}`}
                className={cn("min-h-8 min-w-10 px-2.5 py-1 text-[12px]", SETTINGS_CONTROL_SURFACE_CLASS)}
              >
                {item.displayKey}
              </Kbd>
            </div>
          ) : (
            <ShortcutKeyBadge
              item={item}
              pressAKeyLabel={pressAKeyLabel}
              resetDisabled={hasRecordingShortcut || item.resetDisabled}
            />
          )}
        </ShortcutSettingRow>
      ))}
    </SettingsSection>
  );

  return (
    <SettingsContentLayout
      title={title}
      titleLayout="stacked-left"
      outerTestId="shortcuts-settings-root"
      headerSummary={
        <div className="flex justify-end sm:-mr-2">
          <SettingsActionButton
            tone="header"
            size="standalone"
            onClick={onResetAll}
            disabled={resetDisabled || hasRecordingShortcut}
          >
            {resetAllLabel}
          </SettingsActionButton>
        </div>
      }
    >
      {conflictMessage && (
        <div className="mb-4 rounded-md border border-state-danger-border bg-state-danger-surface px-4 py-2 text-sm text-state-danger-foreground">
          {conflictMessage}
        </div>
      )}

      <div className="-mb-3 grid gap-4 md:grid-cols-2 md:items-start">
        <div className="grid gap-4">
          {firstCategory ? renderCategory(firstCategory) : null}
          {remainingCategories.map(renderCategory)}
        </div>
        <div className="grid gap-4">{secondCategory ? renderCategory(secondCategory) : null}</div>
      </div>
    </SettingsContentLayout>
  );
}
