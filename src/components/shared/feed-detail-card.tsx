import type { HTMLAttributes, ReactNode } from "react";
import { SurfaceCard } from "@/components/shared/surface-card";
import { cn } from "@/lib/utils";

type FeedDetailCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type FeedDetailRowProps = {
  label: ReactNode;
  value: ReactNode;
  surface?: "card" | "low-wire";
};

export function FeedDetailCard({ children, className, ...props }: FeedDetailCardProps) {
  return (
    <SurfaceCard {...props} variant="section" tone="default" padding="default" className={cn("shadow-none", className)}>
      {children}
    </SurfaceCard>
  );
}

export function FeedDetailRow({ label, value, surface = "card" }: FeedDetailRowProps) {
  return (
    <div
      className={cn(
        "min-w-0 px-3 py-2.5 shadow-none",
        surface === "low-wire"
          ? "border-b border-[var(--workspace-low-wire-divider)] bg-transparent last:border-b-0 sm:px-4 sm:py-3"
          : "rounded-md border border-border/55 bg-surface-1/48",
      )}
    >
      <dt className="font-sans text-[10px] tracking-[0.1em] text-foreground-soft uppercase">{label}</dt>
      <dd className="mt-1 truncate text-[0.95rem] font-medium leading-5 text-foreground">{value}</dd>
    </div>
  );
}
