import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type LoadingButtonProps = ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingLabel?: ReactNode;
  disabledWhenLoading?: boolean;
  spinner?: ReactNode;
};

export function LoadingButton({
  children,
  loading = false,
  loadingLabel,
  disabledWhenLoading = true,
  disabled,
  spinner,
  ...props
}: LoadingButtonProps) {
  const resolvedSpinner = spinner ?? (
    <LoaderCircle data-slot="loading-spinner" aria-hidden="true" className="size-3 animate-spin" />
  );

  return (
    <Button {...props} disabled={disabled || (loading && disabledWhenLoading)} aria-busy={loading || undefined}>
      {loading ? resolvedSpinner : null}
      {loading && loadingLabel !== undefined ? loadingLabel : children}
    </Button>
  );
}
