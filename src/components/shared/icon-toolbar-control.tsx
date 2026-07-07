import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import { forwardRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { iconToolbarButtonClassName } from "./icon-toolbar-control-styles";
import { OverlayActionSurface } from "./overlay-action-surface";

type IconToolbarPressedTone = "none" | "neutral" | "accent" | "starred";

type IconToolbarControlBaseProps = {
  label: string;
  tooltipLabel?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipAlign?: "start" | "center" | "end";
  tooltipSideOffset?: number;
  disabled?: boolean;
  ariaDisabled?: boolean;
  allowAriaDisabledClick?: boolean;
  ariaPressed?: boolean;
  className?: string;
  children: ReactNode;
};

type IconToolbarButtonProps = IconToolbarControlBaseProps & {
  onClick: () => void;
};

type IconToolbarToggleProps = IconToolbarControlBaseProps & {
  pressed: boolean;
  onPressedChange: (nextPressed: boolean) => void;
  pressedTone?: IconToolbarPressedTone;
  focusTargetKey?: string;
};

type IconToolbarMenuTriggerProps = IconToolbarControlBaseProps;

const iconToolbarControlVariants = cva(iconToolbarButtonClassName, {
  variants: {
    pressedTone: {
      none: "data-[pressed]:bg-transparent data-[pressed]:text-foreground-soft data-[pressed]:shadow-none data-[pressed]:focus-visible:bg-transparent",
      neutral:
        "data-[pressed]:bg-transparent data-[pressed]:text-foreground data-[pressed]:hover:bg-transparent data-[pressed]:hover:text-foreground data-[pressed]:focus-visible:bg-transparent data-[pressed]:focus-visible:text-foreground",
      accent:
        "data-[pressed]:bg-transparent data-[pressed]:text-primary data-[pressed]:hover:bg-transparent data-[pressed]:hover:text-primary data-[pressed]:focus-visible:bg-transparent data-[pressed]:focus-visible:text-primary",
      starred:
        "data-[pressed]:bg-transparent data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:hover:bg-transparent data-[pressed]:hover:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:focus-visible:bg-transparent data-[pressed]:focus-visible:text-[var(--semantic-tone-starred-content-foreground)]",
    },
  },
  defaultVariants: {
    pressedTone: "neutral",
  },
});

const iconToolbarSurfaceButtonClassName = cn(
  "motion-interactive-surface inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-transparent text-inherit shadow-none outline-none select-none transition-none hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent focus-visible:ring-0 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 disabled:text-foreground-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

type IconToolbarSurfaceButtonProps = IconToolbarButtonProps & {
  compact?: boolean;
  tone?: "default" | "subtle";
  variant?: "default" | "chrome";
};

export const IconToolbarButton = forwardRef<HTMLButtonElement, IconToolbarButtonProps>(function IconToolbarButton(
  {
    label,
    tooltipLabel,
    tooltipSide,
    tooltipAlign,
    tooltipSideOffset,
    disabled = false,
    ariaDisabled,
    allowAriaDisabledClick = false,
    ariaPressed,
    className,
    children,
    onClick,
  },
  ref,
) {
  const handleToolbarButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (ariaDisabled && !allowAriaDisabledClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick();
  };
  const handleToolbarButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (ariaDisabled && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <AppTooltip label={tooltipLabel ?? label} side={tooltipSide} align={tooltipAlign} sideOffset={tooltipSideOffset}>
      <ButtonPrimitive
        ref={ref}
        onClick={handleToolbarButtonClick}
        onKeyDown={handleToolbarButtonKeyDown}
        className={cn(iconToolbarButtonClassName, className)}
        disabled={disabled}
        aria-disabled={ariaDisabled || undefined}
        aria-pressed={ariaPressed}
        aria-label={label}
      >
        {children}
      </ButtonPrimitive>
    </AppTooltip>
  );
});

export function IconToolbarSurfaceButton({
  label,
  tooltipLabel,
  tooltipSide,
  tooltipAlign,
  tooltipSideOffset,
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
      <AppTooltip label={tooltipLabel ?? label} side={tooltipSide} align={tooltipAlign} sideOffset={tooltipSideOffset}>
        <ButtonPrimitive
          onClick={onClick}
          className={cn(iconToolbarSurfaceButtonClassName, className)}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </ButtonPrimitive>
      </AppTooltip>
    </OverlayActionSurface>
  );
}

export function IconToolbarToggle({
  label,
  tooltipLabel,
  tooltipSide,
  tooltipAlign,
  tooltipSideOffset,
  pressed,
  onPressedChange,
  disabled = false,
  className,
  pressedTone,
  focusTargetKey,
  children,
}: IconToolbarToggleProps) {
  return (
    <AppTooltip label={tooltipLabel ?? label} side={tooltipSide} align={tooltipAlign} sideOffset={tooltipSideOffset}>
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
  tooltipSide,
  tooltipAlign,
  tooltipSideOffset,
  disabled = false,
  className,
  children,
}: IconToolbarMenuTriggerProps) {
  return (
    <AppTooltip label={tooltipLabel ?? label} side={tooltipSide} align={tooltipAlign} sideOffset={tooltipSideOffset}>
      <Menu.Trigger
        render={
          <ButtonPrimitive
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
