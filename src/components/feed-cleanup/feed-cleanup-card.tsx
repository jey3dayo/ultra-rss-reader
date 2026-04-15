import { cn } from "@/lib/utils";
import type { FeedCleanupCardProps, FeedCleanupDetailRowProps } from "./feed-cleanup.types";

export function FeedCleanupCard({ children, className }: FeedCleanupCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card px-4 py-4 shadow-elevation-1", className)}>
      {children}
    </div>
  );
}

export function FeedCleanupDetailRow({ label, value }: FeedCleanupDetailRowProps) {
  return (
    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
