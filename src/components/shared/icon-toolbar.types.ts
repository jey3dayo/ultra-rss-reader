import type { ReactNode } from "react";

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

export type IconToolbarButtonProps = IconToolbarControlBaseProps & {
  onClick: () => void;
};

export type IconToolbarToggleProps = IconToolbarControlBaseProps & {
  pressed: boolean;
  onPressedChange: (nextPressed: boolean) => void;
  pressedTone?: IconToolbarPressedTone;
  focusTargetKey?: string;
};

export type IconToolbarMenuTriggerProps = IconToolbarControlBaseProps;
