import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { HeadlessButton } from "@/design-system";
import { cn } from "@/lib/utils";

const settingsActionButtonVariants = cva(
  "motion-interactive-surface inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md bg-transparent outline-none select-none active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      tone: {
        content:
          "border border-border/65 bg-surface-2/82 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-border-strong hover:bg-surface-3/88 hover:text-foreground focus-visible:border-border-strong focus-visible:bg-surface-3/88 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45",
        header:
          "bg-surface-1/84 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-18px_rgba(0,0,0,0.45)] hover:bg-surface-2/92 hover:text-foreground focus-visible:bg-surface-2/92 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45",
        rail: "text-sidebar-foreground/40 hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground focus-visible:bg-[var(--sidebar-hover-surface)] focus-visible:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring/45",
        subtle:
          "text-foreground-soft hover:bg-surface-2/58 hover:text-foreground focus-visible:bg-surface-2/58 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45",
        danger:
          "text-state-danger-foreground/72 hover:bg-state-danger-surface hover:text-state-danger-foreground focus-visible:bg-state-danger-surface focus-visible:text-state-danger-foreground focus-visible:ring-2 focus-visible:ring-destructive/20",
      },
      size: {
        icon: "size-9 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        text: "h-10 w-full px-4 text-sm font-medium sm:w-auto",
        compact: "h-10 px-4 text-sm font-medium",
      },
    },
    defaultVariants: {
      tone: "content",
      size: "text",
    },
  },
);

type SettingsActionButtonProps = ComponentProps<typeof HeadlessButton> &
  VariantProps<typeof settingsActionButtonVariants>;

export function SettingsActionButton({
  className,
  tone = "content",
  size = "text",
  ...props
}: SettingsActionButtonProps) {
  return <HeadlessButton className={cn(settingsActionButtonVariants({ tone, size }), className)} {...props} />;
}
