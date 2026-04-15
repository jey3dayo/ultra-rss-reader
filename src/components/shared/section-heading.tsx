import type { SectionHeadingProps } from "@/components/shared/layout.types";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3 className={cn("mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground-soft", className)}>
      {children}
    </h3>
  );
}
