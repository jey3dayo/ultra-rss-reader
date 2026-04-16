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
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="font-sans text-[11px] tracking-[0.08em] text-foreground-soft uppercase">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
