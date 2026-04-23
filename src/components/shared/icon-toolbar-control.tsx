import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IconToolbarButtonProps, IconToolbarMenuTriggerProps, IconToolbarToggleProps } from "./icon-toolbar.types";
import { OverlayActionSurface } from "./overlay-action-surface";

export const iconToolbarButtonClassName = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "motion-interactive-surface border-transparent bg-transparent text-foreground-soft shadow-none hover:bg-surface-2/72 hover:text-foreground aria-expanded:bg-surface-3/88 aria-expanded:text-foreground focus-visible:border-border/60 focus-visible:bg-surface-2/72 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 active:translate-y-0 disabled:opacity-100 disabled:text-foreground-soft",
);

export const iconToolbarControlVariants = cva(iconToolbarButtonClassName, {
  variants: {
    pressedTone: {
      none: "",
      neutral:
        "data-[pressed]:bg-surface-3/88 data-[pressed]:text-foreground data-[pressed]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
      accent:
        "data-[pressed]:bg-primary/12 data-[pressed]:text-primary data-[pressed]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
      starred:
        "data-[pressed]:bg-[var(--semantic-tone-starred-surface)] data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
    },
  },
  defaultVariants: {
    pressedTone: "neutral",
  },
});

export const iconToolbarSurfaceButtonClassName = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "motion-interactive-surface rounded-lg border-transparent bg-transparent text-inherit shadow-none hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent focus-visible:border-transparent focus-visible:ring-0 active:translate-y-0 disabled:opacity-100 disabled:text-foreground-soft",
);

export const iconToolbarSurfaceControlVariants = cva(iconToolbarSurfaceButtonClassName, {
  variants: {
    pressedTone: {
      none: "",
      neutral: "data-[pressed]:text-foreground",
      accent: "data-[pressed]:text-primary",
    },
  },
  defaultVariants: {
    pressedTone: "neutral",
  },
});

export const iconToolbarSurfaceLabelButtonClassName = cn(
  "motion-interactive-surface inline-flex h-full w-full items-center justify-center gap-1 rounded-lg border border-transparent bg-transparent px-0 text-inherit outline-none focus-visible:border-transparent focus-visible:ring-0 active:translate-y-0 disabled:pointer-events-none disabled:opacity-100 disabled:text-foreground-soft",
);

type IconToolbarSurfaceButtonProps = IconToolbarButtonProps & {
  compact?: boolean;
  tone?: "default" | "subtle";
  variant?: "default" | "chrome";
};

export function IconToolbarButton({
  label,
  tooltipLabel,
  disabled = false,
  ariaDisabled,
  className,
  children,
  onClick,
}: IconToolbarButtonProps) {
  return (
    <AppTooltip label={tooltipLabel ?? label}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(iconToolbarButtonClassName, className)}
        disabled={disabled}
        aria-disabled={ariaDisabled || undefined}
        aria-label={label}
      >
        {children}
      </Button>
    </AppTooltip>
  );
}

export function IconToolbarSurfaceButton({
  label,
  tooltipLabel,
  disabled = false,
  className,
  children,
  onClick,
  compact = true,
  tone = "default",
  variant = "default",
}: IconToolbarSurfaceButtonProps) {
  return (
    <OverlayActionSurface compact={compact} tone={tone} variant={variant}>
      <AppTooltip label={tooltipLabel ?? label}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(iconToolbarSurfaceButtonClassName, className)}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </AppTooltip>
    </OverlayActionSurface>
  );
}

export function IconToolbarToggle({
  label,
  tooltipLabel,
  pressed,
  onPressedChange,
  disabled = false,
  className,
  pressedTone,
  focusTargetKey,
  children,
}: IconToolbarToggleProps) {
  return (
    <AppTooltip label={tooltipLabel ?? label}>
      <Toggle
        pressed={pressed}
        onPressedChange={onPressedChange}
        disabled={disabled}
        aria-label={label}
        data-browser-overlay-return-focus={focusTargetKey}
        className={cn(iconToolbarControlVariants({ pressedTone }), className)}
      >
        {children}
      </Toggle>
    </AppTooltip>
  );
}

export function IconToolbarMenuTrigger({
  label,
  tooltipLabel,
  disabled = false,
  className,
  children,
}: IconToolbarMenuTriggerProps) {
  return (
    <AppTooltip label={tooltipLabel ?? label}>
      <Menu.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(iconToolbarButtonClassName, className)}
            disabled={disabled}
            aria-label={label}
          />
        }
      >
        {children}
      </Menu.Trigger>
    </AppTooltip>
  );
}
