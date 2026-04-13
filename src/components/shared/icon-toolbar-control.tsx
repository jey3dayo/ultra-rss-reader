import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IconToolbarButtonProps, IconToolbarMenuTriggerProps, IconToolbarToggleProps } from "./icon-toolbar.types";

export const iconToolbarButtonClassName = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "text-muted-foreground",
);

const iconToolbarControlVariants = cva(iconToolbarButtonClassName, {
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
