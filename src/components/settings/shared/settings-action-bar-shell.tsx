import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import {
  SETTINGS_CARD_CONTROLS_INSET_CLASS,
  SETTINGS_DETAIL_MAX_WIDTH_CLASS,
  SETTINGS_DIVIDER_CLASS,
} from "./settings-surface";

const settingsActionBarVariants = cva("flex shrink-0 flex-col gap-3 py-3 sm:flex-row sm:items-center", {
  variants: {
    hasMessage: {
      true: "sm:justify-between",
      false: "sm:justify-end",
    },
    alignment: {
      pane: "border-t px-5 sm:px-8",
      "card-controls": `mx-auto w-full ${SETTINGS_DETAIL_MAX_WIDTH_CLASS} ${SETTINGS_CARD_CONTROLS_INSET_CLASS}`,
    },
  },
});

type SettingsActionBarShellProps = {
  testId: string;
  label: string;
  message?: string;
  alignment?: "pane" | "card-controls";
  children: ReactNode;
};

export function SettingsActionBarShell({
  testId,
  label,
  message,
  alignment = "pane",
  children,
}: SettingsActionBarShellProps) {
  const rowClassName = settingsActionBarVariants({ hasMessage: message !== undefined, alignment });
  const content = (
    <>
      {message !== undefined ? (
        <p role="status" className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-[var(--settings-field-changed-border)]"
          />
          {message}
        </p>
      ) : null}
      <div className="sm:w-auto">{children}</div>
    </>
  );

  if (alignment === "card-controls") {
    return (
      <section
        data-testid={testId}
        aria-label={label}
        className={cn("shrink-0 border-t", SETTINGS_DIVIDER_CLASS)}
        style={{ backgroundColor: "var(--settings-shell-content)" }}
      >
        <div className={rowClassName}>{content}</div>
      </section>
    );
  }

  return (
    <section
      data-testid={testId}
      aria-label={label}
      className={cn(rowClassName, SETTINGS_DIVIDER_CLASS)}
      style={{ backgroundColor: "var(--settings-shell-content)" }}
    >
      {content}
    </section>
  );
}
