import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const overlayStageSurfaceVariants = cva("absolute z-10 overflow-hidden bg-background", {
  variants: {
    scope: {
      "main-stage": "",
      "content-pane": "border border-border/60 shadow-elevation-3",
    },
  },
});

type OverlayStageSurfaceProps = HTMLAttributes<HTMLDivElement> &
  Omit<VariantProps<typeof overlayStageSurfaceVariants>, "scope"> & {
    scope: NonNullable<VariantProps<typeof overlayStageSurfaceVariants>["scope"]>;
  };

export function OverlayStageSurface({ scope, className, ...props }: OverlayStageSurfaceProps) {
  return (
    <div {...props} data-overlay-shell="stage" className={cn(overlayStageSurfaceVariants({ scope }), className)} />
  );
}
