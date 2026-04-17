import type { KeyboardEventHandler, ReactNode, RefObject } from "react";

export type LabeledControlRowProps = {
  label: string;
  description?: string;
  children?: ReactNode;
  htmlFor?: string;
  labelId?: string;
  className?: string;
  labelClassName?: string;
};

export type LabeledInputRowProps = {
  label: string;
  name?: string;
  type?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  title?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  rowClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
  inputClassName?: string;
  actionLabel?: string;
  actionAriaLabel?: string;
  actionTooltipLabel?: string;
  actionIcon?: ReactNode;
  actionPlacement?: "inline" | "inside";
  actionVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  actionSize?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  actionClassName?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
};

export type LabeledSelectOption = {
  value: string;
  label: string;
};

export type LabeledSelectRowProps = {
  label: string;
  name: string;
  value: string;
  options: LabeledSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
  rowClassName?: string;
  triggerClassName?: string;
};

export type LabeledSwitchRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  rowClassName?: string;
};
