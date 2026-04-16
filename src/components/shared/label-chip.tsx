import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const labelChipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-sans font-medium leading-none whitespace-nowrap transition-[color,background-color,border-color]",
  {
    variants: {
      tone: {
        neutral: "border-border/70 bg-surface-1/80 text-foreground-soft",
        muted: "border-border/55 bg-background/70 text-muted-foreground",
        success: "border-state-success-border bg-state-success-surface text-state-success-foreground",
        warning: "border-state-warning-border bg-state-warning-surface text-state-warning-foreground",
        danger: "border-destructive/20 bg-destructive/8 text-destructive",
      },
      size: {
        compact: "px-2 py-0.5 text-[10px]",
        default: "px-2.5 py-1 text-[11px]",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "default",
    },
  },
);

type LabelChipProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof labelChipVariants>;

export function LabelChip({ tone, size, className, ...props }: LabelChipProps) {
  return (
    <span data-label-chip={tone ?? "neutral"} className={cn(labelChipVariants({ tone, size }), className)} {...props} />
  );
}
