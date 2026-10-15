export function requireEnabledQueryValue(value: string | null, label: string): string {
  if (!value) {
    throw new Error(`${label} is required when the query is enabled.`);
  }

  return value;
}
