import { cn } from "cn";
import type { HTMLAttributes } from "react";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-surface-3/60", className)} {...props} />;
}
