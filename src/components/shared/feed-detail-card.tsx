import type { CSSProperties, ReactNode } from "react";
import { SurfaceCard } from "@/components/shared/surface-card";
import { cn } from "@/lib/utils";

type FeedDetailCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type FeedDetailRowProps = {
  label: ReactNode;
  value: ReactNode;
};

export function FeedDetailCard({ children, className, style }: FeedDetailCardProps) {
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

export function FeedDetailRow({ label, value }: FeedDetailRowProps) {
  return (
    <div className="rounded-md border border-border/55 bg-surface-1/48 px-3 py-2.5 shadow-none">
      <dt className="font-sans text-[10px] tracking-[0.1em] text-foreground-soft uppercase">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
