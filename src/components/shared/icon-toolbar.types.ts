import type { ReactNode } from "react";

export type IconToolbarPressedTone = "none" | "neutral" | "accent";

export type IconToolbarControlBaseProps = {
  label: string;
  disabled?: boolean;
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
