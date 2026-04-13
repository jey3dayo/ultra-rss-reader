import type { ReactNode } from "react";

export type LabeledControlRowProps = {
  label: string;
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
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  rowClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  actionLabel?: string;
  actionAriaLabel?: string;
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
