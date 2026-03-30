import { cn } from "@/lib/utils";

export function IndeterminateProgress({ className }: { className?: string }) {
  return (
    <div className={cn("h-0.5 overflow-hidden bg-muted", className)}>
      <div className="h-full w-2/5 animate-indeterminate bg-ring" />
    </div>
  );
}
