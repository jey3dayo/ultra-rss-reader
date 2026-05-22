import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type LoadingActionContentProps = {
  loading?: boolean;
  loadingLabel?: ReactNode;
  spinner?: ReactNode;
  children: ReactNode;
};

export function LoadingActionContent({ loading = false, loadingLabel, spinner, children }: LoadingActionContentProps) {
  if (!loading) {
    return children;
  }

  const resolvedSpinner = spinner ?? (
    <LoaderCircle
      data-slot="loading-spinner"
      aria-hidden="true"
      className="size-3 shrink-0 animate-spin text-current"
    />
  );

  return (
    <>
      {resolvedSpinner}
      {loadingLabel !== undefined ? loadingLabel : children}
    </>
  );
}
