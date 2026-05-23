type SelectValueChangeHandlerParams = {
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function createSelectValueChangeHandler({ disabled, onChange }: SelectValueChangeHandlerParams) {
  return (next: string | null) => {
    if (disabled || next === null) {
      return;
    }

    onChange(next);
  };
}
