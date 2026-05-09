import { SelectItem, SelectValue } from "@/components/ui/select";
import { getOptionLabelByValue, type OptionWithLabel } from "@/lib/ui/options";

type SelectOptionContentProps = {
  options: readonly OptionWithLabel[];
};

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

export function SelectOptionValue({ options }: SelectOptionContentProps) {
  return <SelectValue>{(selectedValue: string | null) => getOptionLabelByValue(options, selectedValue)}</SelectValue>;
}

export function SelectOptionItems({ options }: SelectOptionContentProps) {
  return (
    <>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </>
  );
}
