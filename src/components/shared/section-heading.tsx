import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionHeadingProps = {
  children: ReactNode;
  className?: string;
};

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3
      className={cn(
        "mb-3 select-none font-sans text-[13px] leading-[1.35] font-medium text-[color:var(--section-heading-color)]",
        className,
      )}
    >
      {children}
    </h3>
  );
}
