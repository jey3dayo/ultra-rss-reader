import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SettingsActionButton } from "./settings-action-button";

type SettingsLoadingActionButtonProps = Omit<ComponentProps<typeof SettingsActionButton>, "children"> & {
  loading?: boolean;
  loadingLabel?: ReactNode;
  disabledWhenLoading?: boolean;
  spinner?: ReactNode;
  children: ReactNode;
};

export function SettingsLoadingActionButton({
  children,
  loading = false,
  loadingLabel,
  disabledWhenLoading = true,
  disabled,
  spinner,
  className,
  ...props
}: SettingsLoadingActionButtonProps) {
  const resolvedSpinner = spinner ?? (
    <LoaderCircle
      data-slot="loading-spinner"
      aria-hidden="true"
      className="size-3 shrink-0 animate-spin text-current"
    />
  );

  return (
    <SettingsActionButton
      {...props}
      className={cn("gap-2", className)}
      disabled={disabled || (loading && disabledWhenLoading)}
      aria-busy={loading || undefined}
    >
      {loading ? resolvedSpinner : null}
      {loading && loadingLabel !== undefined ? loadingLabel : children}
    </SettingsActionButton>
  );
}
