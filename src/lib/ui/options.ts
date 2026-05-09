export type OptionWithLabel = {
  value: string;
  label: string;
};

export function getOptionLabelByValue(options: readonly OptionWithLabel[], value: string | null) {
  const normalizedValue = value?.trim() ?? "";
  return options.find((option) => option.value === normalizedValue)?.label ?? normalizedValue;
}
