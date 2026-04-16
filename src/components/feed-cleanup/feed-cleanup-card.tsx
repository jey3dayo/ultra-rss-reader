import { SurfaceCard } from "@/components/shared/surface-card";
import { cn } from "@/lib/utils";
import type { FeedCleanupCardProps, FeedCleanupDetailRowProps } from "./feed-cleanup.types";

export function FeedCleanupCard({ children, className, style }: FeedCleanupCardProps) {
  return (
    <SurfaceCard
      variant="section"
      tone="default"
      padding="default"
      className={cn("shadow-none", className)}
      style={style}
    >
      {children}
    </SurfaceCard>
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
