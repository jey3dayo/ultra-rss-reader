import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </h3>
  );
}
