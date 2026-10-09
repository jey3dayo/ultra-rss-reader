import { cn } from "cn";
import type { ComponentProps } from "react";

type IndeterminateProgressProps = ComponentProps<"div">;

export function IndeterminateProgress({ className, ...props }: IndeterminateProgressProps) {
  return (
    <div className={cn("h-0.5 overflow-hidden bg-surface-3/72", className)} {...props}>
      <div className="h-full w-2/5 animate-indeterminate bg-[var(--tone-loading)]" />
    </div>
  );
}
