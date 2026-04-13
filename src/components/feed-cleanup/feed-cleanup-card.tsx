import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FeedCleanupCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card px-4 py-4", className)}>{children}</div>;
}

export function FeedCleanupDetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
