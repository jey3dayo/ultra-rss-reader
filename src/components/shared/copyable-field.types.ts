export type CopyableTextFieldType = "text" | "url" | "password";

export type CopyableTextFieldProps = {
  label: string;
  name: string;
  value: string;
  copyLabel?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  type?: CopyableTextFieldType;
  onCopy?: () => void;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
};

export type CopyableReadonlyFieldProps = Omit<
  CopyableTextFieldProps,
  "readOnly" | "placeholder" | "className" | "type" | "onChange" | "onBlur" | "onFocus"
>;

export type CopyableReadonlyFieldItem = CopyableReadonlyFieldProps & {
  key: string;
};

export type CopyableReadonlyFieldListProps = {
  fields: CopyableReadonlyFieldItem[];
  className?: string;
};
