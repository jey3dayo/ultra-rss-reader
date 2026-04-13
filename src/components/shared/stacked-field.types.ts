import type { RefObject } from "react";

export type StackedInputFieldProps = {
  label: string;
  name?: string;
  type?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

export type StackedSelectOption = {
  value: string;
  label: string;
};

export type StackedSelectFieldProps = {
  labelId?: string;
  label: string;
  name: string;
  value: string;
  options: readonly StackedSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
};
