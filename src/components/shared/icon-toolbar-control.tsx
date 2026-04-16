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
  "text-muted-foreground",
);

export const iconToolbarControlVariants = cva(iconToolbarButtonClassName, {
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

export const iconToolbarSurfaceButtonClassName = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "rounded-lg border-transparent bg-transparent text-inherit shadow-none hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent focus-visible:border-transparent focus-visible:ring-0 active:translate-y-0 disabled:opacity-100 disabled:text-foreground-soft",
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
  "inline-flex h-full w-full items-center justify-center gap-1 rounded-lg border border-transparent bg-transparent px-0 text-inherit outline-none transition-[color,background-color,border-color,opacity,box-shadow,transform] focus-visible:border-transparent focus-visible:ring-0 active:translate-y-0 disabled:pointer-events-none disabled:opacity-100 disabled:text-foreground-soft",
);

type IconToolbarSurfaceButtonProps = IconToolbarButtonProps & {
  compact?: boolean;
  tone?: "default" | "subtle";
  variant?: "default" | "chrome";
};

export function IconToolbarButton({ label, disabled = false, className, children, onClick }: IconToolbarButtonProps) {
  return (
    <AppTooltip label={label}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(iconToolbarButtonClassName, className)}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </Button>
    </AppTooltip>
  );
}

export function IconToolbarSurfaceButton({
  label,
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
      <AppTooltip label={label}>
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
  pressed,
  onPressedChange,
  disabled = false,
  className,
  pressedTone,
  focusTargetKey,
  children,
}: IconToolbarToggleProps) {
  return (
    <AppTooltip label={label}>
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

export function IconToolbarMenuTrigger({ label, disabled = false, className, children }: IconToolbarMenuTriggerProps) {
  return (
    <AppTooltip label={label}>
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
