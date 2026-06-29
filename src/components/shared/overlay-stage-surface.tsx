import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const overlayStageSurfaceVariants = cva("absolute z-10 overflow-hidden", {
  variants: {
    scope: {
      "main-stage": "rounded-none bg-background",
      "content-pane": "rounded-none bg-transparent",
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
