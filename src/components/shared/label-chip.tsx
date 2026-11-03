import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { HTMLAttributes } from "react";
import { stateToneSurfaceClassNames } from "@/components/shared/state-tone";

const labelChipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-sans font-medium leading-none whitespace-nowrap tabular-nums transition-[color,background-color,border-color] duration-150 ease-standard motion-reduce:transition-none",
  {
    variants: {
      tone: {
        neutral: "border-border/70 bg-surface-1/80 text-foreground-soft",
        muted: "border-border/55 bg-background/70 text-foreground-soft",
        success: stateToneSurfaceClassNames.success,
        warning: stateToneSurfaceClassNames.warning,
        danger: stateToneSurfaceClassNames.danger,
      },
      size: {
        compact: "px-2 py-0.5 text-(length:--font-size-2xs)",
        default: "px-2.5 py-1 text-(length:--font-size-2xs)",
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
