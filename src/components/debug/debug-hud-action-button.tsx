import type { ComponentProps } from "react";
import { Button } from "@/design-system";
import { cn } from "@/lib/utils";

type DebugHudActionButtonProps = ComponentProps<typeof Button>;

export function DebugHudActionButton({ className, ...props }: DebugHudActionButtonProps) {
  return (
    <Button
      data-debug-hud-action-button=""
      className={cn(
        "motion-interactive-surface inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border-0 bg-transparent px-2 text-[11px] font-medium text-white/56 shadow-none outline-none select-none transition-none",
        "hover:border-transparent hover:bg-white/[0.04] hover:text-white/82",
        "focus-visible:border-transparent focus-visible:bg-white/[0.04] focus-visible:text-white/82 focus-visible:ring-white/16",
        "active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}
