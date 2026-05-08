import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  children: ReactNode;
  className?: string;
};

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3
      className={cn(
        "mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--section-heading-color)]",
        className,
      )}
    >
      {children}
    </h3>
  );
}
