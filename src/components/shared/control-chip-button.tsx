import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { controlChipVariants } from "./control-chip";

type ControlChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
  children: ReactNode;
  size?: "compact" | "comfortable";
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
        "rounded-full border border-[rgba(38,37,30,0.1)] bg-[rgba(242,241,237,0.92)] text-[rgba(38,37,30,0.62)]",
        "shadow-[0_0_0_1px_rgba(38,37,30,0.03)] hover:bg-[rgba(230,229,224,0.96)] hover:text-[rgb(38,37,30)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[pressed]:border-[rgba(38,37,30,0.16)] data-[pressed]:bg-[rgba(225,224,219,0.96)] data-[pressed]:text-[rgb(38,37,30)]",
        "dark:border-border/70 dark:bg-background/80 dark:text-muted-foreground dark:hover:bg-card/80 dark:hover:text-foreground",
        "dark:data-[pressed]:border-border/80 dark:data-[pressed]:bg-card/85 dark:data-[pressed]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
