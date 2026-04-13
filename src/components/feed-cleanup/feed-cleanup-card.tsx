import { cn } from "@/lib/utils";
import type { FeedCleanupCardProps, FeedCleanupDetailRowProps } from "./feed-cleanup.types";

export function FeedCleanupCard({ children, className }: FeedCleanupCardProps) {
  return <div className={cn("rounded-xl border border-border bg-card px-4 py-4", className)}>{children}</div>;
}

export function FeedCleanupDetailRow({ label, value }: FeedCleanupDetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
