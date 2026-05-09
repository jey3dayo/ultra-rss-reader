import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

export const iconToolbarButtonClassName = cn(
  "motion-interactive-surface inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-transparent text-foreground-soft shadow-none outline-none select-none transition-none md:size-8 hover:bg-surface-2/64 hover:text-foreground aria-expanded:bg-surface-3/88 aria-expanded:text-foreground focus-visible:bg-surface-2/64 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 active:translate-y-0 disabled:pointer-events-none disabled:opacity-100 disabled:text-foreground-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

export const iconToolbarControlVariants = cva(iconToolbarButtonClassName, {
  variants: {
    pressedTone: {
      none: "data-[pressed]:bg-transparent data-[pressed]:text-foreground-soft data-[pressed]:shadow-none data-[pressed]:focus-visible:bg-transparent",
      neutral:
        "data-[pressed]:bg-surface-3/88 data-[pressed]:text-foreground data-[pressed]:hover:bg-surface-3/88 data-[pressed]:hover:text-foreground data-[pressed]:focus-visible:bg-surface-3/88 data-[pressed]:focus-visible:text-foreground",
      accent:
        "data-[pressed]:bg-primary/12 data-[pressed]:text-primary data-[pressed]:hover:bg-primary/12 data-[pressed]:hover:text-primary data-[pressed]:focus-visible:bg-primary/12 data-[pressed]:focus-visible:text-primary",
      starred:
        "data-[pressed]:bg-[var(--semantic-tone-starred-surface)] data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:hover:bg-[var(--semantic-tone-starred-surface)] data-[pressed]:hover:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:focus-visible:bg-[var(--semantic-tone-starred-surface)] data-[pressed]:focus-visible:text-[var(--semantic-tone-starred-content-foreground)]",
    },
  },
  defaultVariants: {
    pressedTone: "neutral",
  },
});

export const iconToolbarSurfaceButtonClassName = cn(
  "motion-interactive-surface inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-transparent text-inherit shadow-none outline-none select-none transition-none md:size-8 hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent focus-visible:ring-0 active:translate-y-0 disabled:pointer-events-none disabled:opacity-100 disabled:text-foreground-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
  "motion-interactive-surface inline-flex h-full w-full items-center justify-center gap-1 rounded-lg bg-transparent px-0 text-inherit outline-none focus-visible:ring-0 active:translate-y-0 disabled:pointer-events-none disabled:opacity-100 disabled:text-foreground-soft",
);

type IconToolbarSurfaceButtonProps = IconToolbarButtonProps & {
  compact?: boolean;
  tone?: "default" | "subtle";
  variant?: "default" | "chrome";
};

export function IconToolbarButton({
  label,
  tooltipLabel,
  tooltipSide,
  tooltipAlign,
  tooltipSideOffset,
  disabled = false,
  ariaDisabled,
  ariaPressed,
  className,
  children,
  onClick,
}: IconToolbarButtonProps) {
  const handleToolbarButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (ariaDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick();
  };
  const preventAriaDisabledKeyboardActivation = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (ariaDisabled && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <AppTooltip label={tooltipLabel ?? label} side={tooltipSide} align={tooltipAlign} sideOffset={tooltipSideOffset}>
      <ButtonPrimitive
        onClick={handleToolbarButtonClick}
        onKeyDown={preventAriaDisabledKeyboardActivation}
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
}

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
