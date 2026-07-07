import { cn } from "@/lib/utils";

export const ghostUtilityActionInteractionClassName = cn(
  "bg-transparent shadow-none hover:bg-transparent focus-visible:bg-transparent active:translate-y-0",
);

export const iconToolbarButtonClassName = cn(
  "motion-interactive-surface inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground-soft outline-none select-none transition-none hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-50 disabled:text-foreground-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ghostUtilityActionInteractionClassName,
);
