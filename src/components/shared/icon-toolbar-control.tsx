import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

type IconToolbarControlBaseProps = {
  label: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

type IconToolbarButtonProps = IconToolbarControlBaseProps & {
  onClick: () => void;
};

type IconToolbarToggleProps = IconToolbarControlBaseProps &
  VariantProps<typeof iconToolbarControlVariants> & {
    pressed: boolean;
    onPressedChange: (nextPressed: boolean) => void;
  };

type IconToolbarMenuTriggerProps = IconToolbarControlBaseProps;

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
  children,
}: IconToolbarToggleProps) {
  return (
    <AppTooltip label={label}>
      <Toggle
        pressed={pressed}
        onPressedChange={onPressedChange}
        disabled={disabled}
        aria-label={label}
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
