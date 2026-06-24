import { cn } from "@/lib/utils";

export const iconToolbarButtonClassName = cn(
  "motion-interactive-surface inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-transparent text-foreground-soft shadow-none outline-none select-none transition-none hover:bg-surface-2/64 hover:text-foreground aria-expanded:bg-surface-3/88 aria-expanded:text-foreground focus-visible:bg-surface-2/64 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 active:translate-y-0 disabled:pointer-events-none disabled:opacity-100 disabled:text-foreground-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);
