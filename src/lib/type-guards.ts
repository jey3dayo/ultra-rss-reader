export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNumberValue(value: unknown): value is number {
  return typeof value === "number";
}
