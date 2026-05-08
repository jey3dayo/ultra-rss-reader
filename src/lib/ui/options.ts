export type OptionWithLabel = {
  value: string;
  label: string;
};

export function getOptionLabelByValue(options: readonly OptionWithLabel[], value: string | null) {
  return options.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";
}
