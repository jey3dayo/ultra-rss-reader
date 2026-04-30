import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { controlChipVariants } from "@/components/shared/control-chip";
import { cn } from "@/lib/utils";

type TagPickerTriggerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  compact?: boolean;
  expanded?: boolean;
};

type TagOptionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  swatchColor?: string | null;
  children: ReactNode;
};

export const TagPickerTriggerButton = forwardRef<HTMLButtonElement, TagPickerTriggerButtonProps>(
  ({ children, className, compact = false, expanded = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        controlChipVariants({ size: compact ? "pickerCompact" : "picker", interaction: "action" }),
        "justify-center rounded-full border text-foreground-soft select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
        "motion-interactive-surface",
        expanded
          ? "border-border/60 bg-surface-2/88 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-border/45 bg-background/12 hover:border-border/60 hover:bg-surface-1/72 hover:text-foreground focus-visible:border-border/60 focus-visible:bg-surface-1/72 focus-visible:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

TagPickerTriggerButton.displayName = "TagPickerTriggerButton";

export const TagOptionButton = forwardRef<HTMLButtonElement, TagOptionButtonProps>(
  ({ children, className, swatchColor, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "motion-static-hover-surface flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-1/72",
        className,
      )}
      {...props}
    >
      {swatchColor ? (
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: swatchColor }} />
      ) : null}
      {children}
    </button>
  ),
);

TagOptionButton.displayName = "TagOptionButton";
