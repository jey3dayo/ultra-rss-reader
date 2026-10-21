import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import { SETTINGS_DIVIDER_CLASS } from "./settings-surface";

const settingsActionBarVariants = cva(
  "flex shrink-0 flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:px-8",
  {
    variants: {
      hasMessage: {
        true: "sm:justify-between",
        false: "sm:justify-end",
      },
    },
  },
);

type SettingsActionBarShellProps = {
  testId: string;
  label: string;
  message?: string;
  children: ReactNode;
};

export function SettingsActionBarShell({ testId, label, message, children }: SettingsActionBarShellProps) {
  return (
    <section
      data-testid={testId}
      aria-label={label}
      className={cn(settingsActionBarVariants({ hasMessage: message !== undefined }), SETTINGS_DIVIDER_CLASS)}
      style={{ backgroundColor: "var(--settings-shell-content)" }}
    >
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
    </section>
  );
}
