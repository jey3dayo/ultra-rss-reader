import type { SectionHeadingProps } from "@/components/shared/layout.types";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3 className={cn("mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/52", className)}>
      {children}
    </h3>
  );
}
