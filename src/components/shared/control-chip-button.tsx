import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { controlChipVariants } from "./control-chip";

type ControlChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
  children: ReactNode;
  size?: "compact" | "filter" | "comfortable";
};

export function ControlChipButton({
  pressed = false,
  size = "compact",
  className,
  type = "button",
  children,
  ...props
}: ControlChipButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      data-pressed={pressed ? "" : undefined}
      className={cn(
        controlChipVariants({ size, interaction: "toggle" }),
        "motion-interactive-surface motion-contextual-surface rounded-full border border-border/70 bg-surface-2/88 text-foreground-soft shadow-elevation-1 hover:bg-surface-3 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "[&_[data-label-chip]]:border-border/45 [&_[data-label-chip]]:bg-background/58 [&_[data-label-chip]]:text-foreground/62",
        "data-[pressed]:border-border-strong data-[pressed]:bg-surface-4 data-[pressed]:text-foreground data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]",
        "data-[pressed]:[&_[data-label-chip]]:border-border-strong/85 data-[pressed]:[&_[data-label-chip]]:bg-surface-1/92 data-[pressed]:[&_[data-label-chip]]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
