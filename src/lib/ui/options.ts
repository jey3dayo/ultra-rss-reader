export type OptionWithLabel = {
  value: string;
  label: string;
};

const UNKNOWN_OPTION_LABEL = "Unknown";

export function getOptionLabelByValue(options: readonly OptionWithLabel[], value: string | null) {
  const normalizedValue = value?.trim() ?? "";
  return options.find((option) => option.value === normalizedValue)?.label ?? (normalizedValue || UNKNOWN_OPTION_LABEL);
}
