import { cn } from "cn";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { LoadingActionContent } from "@/design-system";
import { SettingsActionButton } from "./shared/settings-action-button";

type SettingsLoadingActionButtonProps = Omit<ComponentProps<typeof SettingsActionButton>, "children"> & {
  loading?: boolean;
  loadingLabel?: ReactNode;
  disabledWhenLoading?: boolean;
  spinner?: ReactNode;
  success?: boolean;
  successLabel?: ReactNode;
  children: ReactNode;
};

export function SettingsLoadingActionButton({
  children,
  loading = false,
  loadingLabel,
  disabledWhenLoading = true,
  disabled,
  spinner,
  success = false,
  successLabel,
  className,
  tone,
  ...props
}: SettingsLoadingActionButtonProps) {
  const showSuccess = success && !loading && !disabled;

  return (
    <SettingsActionButton
      {...props}
      className={cn("gap-2", className)}
      tone={showSuccess ? "success" : tone}
      disabled={disabled || (loading && disabledWhenLoading)}
      aria-busy={loading || undefined}
    >
      <LoadingActionContent loading={loading} loadingLabel={loadingLabel} spinner={spinner}>
        {showSuccess ? (
          <span className="inline-flex items-center gap-2" aria-live="polite" aria-atomic="true">
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
            {successLabel ?? children}
          </span>
        ) : (
          children
        )}
      </LoadingActionContent>
    </SettingsActionButton>
  );
}
