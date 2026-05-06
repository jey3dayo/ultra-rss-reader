import { SelectItem, SelectValue } from "@/components/ui/select";
import { getOptionLabelByValue, type OptionWithLabel } from "@/lib/options";

type SelectOptionContentProps = {
  options: readonly OptionWithLabel[];
};

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
