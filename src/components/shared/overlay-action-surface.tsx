import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const overlayActionSurfaceVariants = cva("motion-pressable-surface pointer-events-auto rounded-lg text-foreground", {
  variants: {
    compact: {
      true: "size-11 md:size-8",
      false: "h-8 px-3 text-[0.78rem] font-medium tracking-[0.02em]",
    },
    variant: {
      default:
        "border border-border/75 bg-overlay-action-surface shadow-elevation-2 backdrop-blur-md hover:border-border-strong hover:bg-overlay-action-surface-hover hover:text-foreground has-[:focus-visible]:border-border-strong has-[:focus-visible]:bg-overlay-action-surface-focus has-[:focus-visible]:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/70 has-[:focus-visible]:ring-offset-0 has-[:active]:border-border-strong has-[:active]:bg-overlay-action-surface-hover has-[:active]:shadow-elevation-1",
      chrome:
        "bg-transparent text-foreground-soft shadow-none hover:bg-transparent hover:text-foreground has-[:focus-visible]:bg-transparent has-[:focus-visible]:text-foreground has-[:focus-visible]:ring-0 has-[:focus-visible]:ring-offset-0 has-[:active]:bg-overlay-action-surface-chrome-active has-[:active]:shadow-none",
    },
    tone: {
      default: "",
      subtle: "bg-overlay-action-surface-subtle border-border/70",
    },
  },
  defaultVariants: {
    compact: false,
    tone: "default",
    variant: "default",
  },
});

type OverlayActionSurfaceProps = HTMLAttributes<HTMLDivElement> &
  Omit<VariantProps<typeof overlayActionSurfaceVariants>, "compact"> & {
    compact: boolean;
  };

export function OverlayActionSurface({ compact, tone, variant, className, ...props }: OverlayActionSurfaceProps) {
  return (
    <div
      {...props}
      data-overlay-shell="action"
      className={cn(overlayActionSurfaceVariants({ compact, tone, variant }), className)}
    />
  );
}
