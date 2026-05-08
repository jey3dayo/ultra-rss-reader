import { cn } from "@/lib/utils";

type IndeterminateProgressProps = {
  className?: string;
};

export function IndeterminateProgress({ className }: IndeterminateProgressProps) {
  return (
    <div className={cn("h-0.5 overflow-hidden bg-surface-3/72", className)}>
      <div className="h-full w-2/5 animate-indeterminate bg-[var(--tone-loading)]" />
    </div>
  );
}
