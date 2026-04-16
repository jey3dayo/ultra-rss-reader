import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const overlayActionSurfaceVariants = cva(
  "pointer-events-auto rounded-lg text-foreground backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150",
  {
    variants: {
      compact: {
        true: "size-11 md:size-8",
        false: "h-8 px-3 text-[0.78rem] font-medium tracking-[0.02em]",
      },
      variant: {
        default:
          "border border-border/75 bg-background/78 shadow-elevation-2 hover:border-border-strong hover:bg-card/92 hover:text-foreground has-[:focus-visible]:border-border-strong has-[:focus-visible]:bg-card/96 has-[:focus-visible]:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/70 has-[:focus-visible]:ring-offset-0 has-[:active]:scale-[0.97] has-[:active]:border-border-strong has-[:active]:bg-card has-[:active]:shadow-elevation-1",
        chrome:
          "border border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-background/8 hover:text-foreground has-[:focus-visible]:border-transparent has-[:focus-visible]:bg-background/10 has-[:focus-visible]:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60 has-[:focus-visible]:ring-offset-0 has-[:active]:scale-[0.97] has-[:active]:border-transparent has-[:active]:bg-background/12 has-[:active]:shadow-none",
      },
      tone: {
        default: "",
        subtle: "bg-background/72 border-border/70",
      },
    },
    defaultVariants: {
      compact: false,
      tone: "default",
      variant: "default",
    },
  },
);

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
