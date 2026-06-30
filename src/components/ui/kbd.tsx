import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type KbdProps = ComponentPropsWithoutRef<"kbd">;

function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex min-h-6 min-w-6 items-center justify-center rounded-md border border-border bg-surface-1 px-2 py-0.5 text-center font-mono text-xs leading-none font-medium tracking-[0.02em] text-foreground-soft",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
