import type { SectionHeadingProps } from "@/components/shared/layout.types";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3 className={cn("mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </h3>
  );
}
