import type { ComponentProps, ReactNode } from "react";
import { LoadingActionContent } from "@/design-system";
import { cn } from "@/lib/utils";
import { SettingsActionButton } from "./shared/settings-action-button";

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
  return (
    <SettingsActionButton
      {...props}
      className={cn("gap-2", className)}
      disabled={disabled || (loading && disabledWhenLoading)}
      aria-busy={loading || undefined}
    >
      <LoadingActionContent loading={loading} loadingLabel={loadingLabel} spinner={spinner}>
        {children}
      </LoadingActionContent>
    </SettingsActionButton>
  );
}
